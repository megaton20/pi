const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const stateData = require("../model/stateAndLGA");
const fs = require('fs'); // Use fs.promises for file operations
const path = require('path');
const { Parser } = require('json2csv');
const calculateCashback = require('../model/cashback');
const generateExclusiveCodeFunction = require('../model/generateExclusiveCode');
const {v4:uuidv4} = require('uuid')


const systemCalander = new Date().toLocaleDateString();
const yearModel = require("../model/getYear");
let presentYear = yearModel(systemCalander, "/");

const monthNameModel = require("../model/findCurrentMonth");
let monthName = monthNameModel(systemCalander, "/");

const dayModel = require("../model/dayOfWeek");
let dayName = dayModel(systemCalander, "/");

const monthModel = require("../model/getMonth");
let presentMonth = monthModel(systemCalander, "/");

const getDay = require("../model/getDay");

let presentDay = getDay(systemCalander, "/");

let sqlDate = presentYear + "-" + presentMonth + "-" + presentDay;


const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};



exports.getAdminWelcomePage = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  let msg = []
  try {
    // Fetch canceled orders
    const canceledOrdersResult = await query(`SELECT * FROM "Orders" WHERE "status" = 'canceled'`);
    const totalCanceledOrder = canceledOrdersResult.rows;

    // Fetch shipping fees from resolved sales
    const shippingFeeResult = await query(
      `SELECT "shipping_fee" FROM "Sales" WHERE "status" = 'resolved'`
    );
    const shippingFee = shippingFeeResult.rows;
    const shippingProfitMade = shippingFee.reduce(
      (acc, sale) => acc + parseFloat(sale.shipping_fee),
      0
    );
    const formatedProfitForShipping = shippingProfitMade.toLocaleString("en-US");

    // Fetch returned amounts
    const returnedAmountResult = await query(
      `SELECT "subTotal" FROM "Order_Products" WHERE "status" = 'returned'`
    );
    const returnedAmount = returnedAmountResult.rows;
    const returnedSum = returnedAmount.reduce(
      (acc, item) => acc + item.subTotal, // Adjust if needed
      0
    );

    // Fetch total sales made
    const allSalesAmountResult = await query(
      `SELECT "total_amount" FROM "Sales" WHERE "status" = 'resolved'`
    );
    const allSalesAmount = allSalesAmountResult.rows;
    const salesMade = allSalesAmount.reduce(
      (acc, item) => acc + parseFloat(item.total_amount),
      0
    );
    const totalAmount = salesMade - returnedSum;
    const formatedProfit = totalAmount.toLocaleString("en-US");

    // Fetch sales by type and order status
    const counterSaleDataResults = await query(
      `SELECT * FROM "Sales" WHERE "sale_type" = 'counter'`
    );
    const counterSaleData = counterSaleDataResults.rows;

    const shippedDataResult = await query(`SELECT * FROM "Orders" WHERE "status" = 'shipped'`);
    const shippedData = shippedDataResult.rows;
    if (shippedData.length >0) {
    msg.push( { type: 'warning', text:`${shippedData.length} On route` })
    }
    const orderDataResult = await query(`SELECT * FROM "Orders" WHERE "status" = 'complete'`);
    const orderData = orderDataResult.rows;
    const completedOrders = orderData.length;

    const pendingOrderDataResult = await query(`SELECT * FROM "Orders" WHERE "status" IN ('incomplete', 'waiting')`);
    const pendingOrderData = pendingOrderDataResult.rows;
    const pendingOrders = pendingOrderData.length;
    if (pendingOrders >0) {
      msg.push( { type: 'error', text:`${pendingOrders} order(s) waiting for your attention` })
    }

    const unresolvedSalesResult = await query(`SELECT * FROM "Sales" WHERE "status" = 'unresolved'`);
    const unresolvedSales = unresolvedSalesResult.rows;
    if (unresolvedSales.length >0) {
      msg.push( { type: 'error', text:`${unresolvedSales.length} waiting to be resolved!` })
      
    }

    const allReturnsOrdersResult = await query(`SELECT * FROM "Order_Products" WHERE "status" = 'returned'`);
    const allReturnsOrders = allReturnsOrdersResult.rows;

    const allSalesResult = await query(`SELECT * FROM "Sales" WHERE "status" = 'resolved'`);
    const allSales = allSalesResult.rows;
    const totalNumberOfSales = allSales.length;

    allSales.forEach(sales => {
      sales.created_date = formatDate(sales.created_date);
    });

    const totalVerifiedUsersResult = await query(`SELECT * FROM "Users" WHERE "userRole" = $1 ORDER BY "spending" DESC`,["user"]);
    const totalVerifiedUsers = totalVerifiedUsersResult.rows;

    totalVerifiedUsers.forEach(resultz => {
      const date = new Date(resultz.previous_visit);
      resultz.previous_visit = date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).replace(',', '');
    });


    const { rows: topSelling } = await query(`
    SELECT 
      p.id AS product_id,
      p."ProductName",
      p.details,
      p."UnitPrice",
      p."inventory_id",
      p."image",
      SUM(po.quantity) AS total_sold
    FROM "Order_Products" po
    JOIN "Products" p ON po.product_id = p.id
    WHERE po.status NOT IN ('canceled', 'pending')
    GROUP BY p.id, p."ProductName", p.details, p."UnitPrice", p."inventory_id", p."image"
    ORDER BY total_sold DESC
    LIMIT 10;
  `);


    res.render("./super/superHome", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      userActive: true,
      totalVerifiedUsers,
      allSales,
      totalNumberOfSales,
      allReturnsOrders,
      formatedProfit,
      formatedProfitForShipping,
      counterSaleData,
      shippedData,
      pendingOrders,
      completedOrders,
      totalCanceledOrder,
      unresolvedSales,
      msg,
      topSelling
    });

  } catch (error) {
    console.log(error);
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.gettAllPriceRegions = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch all logistic companies from the "Logistics" table
    const {rows:results} = await query(`SELECT * FROM "shipping_regions"`);


    // Render the view with the fetched data
    return res.render("./super/price-region-table", {
      pageTitle: "All price and region",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      results,
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic companies: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.getAddRegions = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch all logistic companies from the "Logistics" table

    // Render the view with the fetched data
    return res.render("./super/price-region-form", {
      pageTitle: "create price and region",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,

    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic companies: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.createNewRegion = async (req, res) => {
  const { state, lga, fee } = req.body;

  // Check for missing fields
  if (!(state && lga && fee)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    const newuuid = uuidv4()
    // Check if discount with the same name already exists
    const checkResult = await query(`SELECT * FROM "shipping_regions" WHERE "state" = $1 AND "lga" = $2`, [state, lga]);

    if (checkResult.rows.length <= 0) {
      // Insert new discount
      await query(`INSERT INTO "shipping_regions" ("id", "state", "lga", "fee") VALUES ($1, $2, $3,$4)`, 
      [ newuuid, state, lga, fee]);

      req.flash("success_msg", `Added successfully!`);
      return res.redirect("/super/all-regions");
    }

    req.flash("error_msg", `"${state}/${lga}" already exists!`);
    return res.redirect("back");
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


exports.getOneRegions = async (req, res) => {

  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {

    const {rows:results} = await query(`SELECT * FROM "shipping_regions" WHERE "id" = $1`, [req.params.id]);
    // Render the view with the fetched data
    return res.render("./super/price-region-edit", {
      pageTitle: "create price and region",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
      results
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic companies: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.updateRegion = async (req, res) => {
  const {  fee } = req.body;

  // Check for missing fields
  if (!(fee)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {

      await query(`UPDATE "shipping_regions" SET  "fee" = $1 WHERE "id" = $2`, [ fee, req.params.id]);
      
      req.flash("success_msg", `Added successfully!`);
      return res.redirect("/super/all-regions");


  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};

// All employees table
exports.getAllEmployees = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all users with roles 'admin' or 'super'
    const results = await query(`SELECT * FROM "Users" WHERE "userRole" = 'admin' OR "userRole" = 'super'`);
    const allUsers = results.rows; // Retrieve the rows from the result

    // Render the employee table with the fetched data
    res.render("./super/employeeTable", {
      pageTitle: "All Employees",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allUsers,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.getAllUsersToUpgrade = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all users with the role 'user'
    const results = await query(`SELECT * FROM "Users" WHERE "userRole" = $1`, ['user']);
    const allUsers = results.rows; // Extract data using .rows

    // Format the previous visit date for each user
    allUsers.forEach((user) => {
      user.previous_visit = formatDate(user.previous_visit);
    });

    // Render the user upgrade page with the fetched data
    res.render("./super/userUpgrade", {
      pageTitle: "All users to upgrade",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allUsers,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.usersToUpgrade = async (req, res) => {
  const selectedUser = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all positions
    const results = await query(`SELECT * FROM "Positions"`);
    const allPositions = results.rows;
    if (allPositions.length === 0) {
      req.flash('error_msg', "Position not found. Create new positions.");
      return res.redirect('/super/create-position');
    }

    // Fetch all stores
    const allStoresResult = await query(`SELECT * FROM "Stores"`);
    const allStores = allStoresResult.rows;
    if (allStores.length === 0) {
      req.flash('error_msg', "Store not found. Add store to continue.");
      return res.redirect('/super/create-store');
    }
    // Fetch the selected user details
    const allUsersResult = await query(`SELECT * FROM "Users" WHERE id = $1`, [selectedUser]);
    
    // Check if user exists and their role
    if (allUsersResult.rows.length > 0 && allUsersResult.rows[0].userRole === "super") {
      req.flash('warning_msg', `Cannot upgrade this user`);
      return res.redirect('/super');
    }
    
    const allUsers = allUsersResult.rows[0];

    res.render("./super/userEditUpgrade", {
      pageTitle: "All users",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
      allUsers,
      allPositions,
      allStores,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.postUsersToUpgrade = async (req, res) => {

  const userId = req.params.id;
  const { store_name, position } = req.body;

  if (!(store_name && position)) {
    req.flash("error_msg", "Please enter all fields");
    return res.redirect(`/super/upgrade-users/${userId}`);
  }


  try {
    // Check if the position exists
    const positionResult = await query(`SELECT * FROM "Positions" WHERE "Position_name" = $1`, [position]);
    if (positionResult.rows.length === 0) {
      req.flash('warning_msg', "Position not found. Create new positions.");
      return res.redirect('/super/create-position');
    }

    const positionData = positionResult.rows[0];
    const positionId = positionData.id;
    const positionSalary = positionData.Salary;

    // Check if the store exists
    const storeResult = await query(`SELECT * FROM "Stores" WHERE "store_name" = $1`, [store_name]);
    if (storeResult.rows.length === 0) {
      req.flash('warning_msg', "Store not found. Add store to continue.");
      return res.redirect('/super/create-store');
    }

    const storeData = storeResult.rows[0];
    const storeId = storeData.id;

    // Update the user with the new role, store, and position details
    await query(
      `UPDATE "Users" SET "userRole" = $1, "store_name" = $2, "salary" = $3, "position" = $4, "position_id" = $5, "store_id" = $6 WHERE id = $7`,
      ["admin", store_name, positionSalary, position, positionId, storeId, userId]
    );

    req.flash("success_msg", "User upgraded successfully");
    return res.redirect("/super/upgrade-users");

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect(`/super/upgrade-users/${userId}`);
  }
};


exports.getAllSales = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all sales records from the database
    const results = await query(`SELECT * FROM "Sales"`);
    const allSales = results.rows; // PostgreSQL returns rows directly

    // Format the date field for each sale
    allSales.forEach((sale) => {
      sale.created_date = formatDate(sale.created_date); // Assuming 'created_date' is the date field in your Sales table
    });

    // Render the salesTable view with the fetched data
    res.render("./super/salesTable", {
      pageTitle: "All Sales Records",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allSales,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

// All unresolved  sales table
exports.getAllUnresolvedSales = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all unresolved sales records from the database
    const results = await query(`SELECT * FROM "Sales" WHERE status = $1`, ['unresolved']);
    const allSales = results.rows; // PostgreSQL returns rows directly

    // Format the date field for each sale
    allSales.forEach((sale) => {
      sale.created_date = formatDate(sale.created_date); // Assuming 'created_date' is the date field in your Sales table
    });

    // Render the salesTable view with the fetched data
    res.render("./super/salesTable", {
      pageTitle: "Unresolved Sales Record",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allSales,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// All Damaged table
exports.getAllDamaged = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all records from the Damaged table in PostgreSQL
    const results = await query(`SELECT * FROM "Damaged"`);
    const allDamaged = results.rows; // PostgreSQL returns rows directly

    // Render the damageTable view with the fetched data
    res.render("./super/damageTable", {
      pageTitle: "Damaged Items",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allDamaged,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

// all customers tabble
exports.getAllCustomers = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all users with userRole as 'user' from the Users table
    const results = await query(`SELECT * FROM "Users" WHERE "userRole" = $1`, ['user']);
    let allCustomers = results.rows; // PostgreSQL returns rows directly

    // Format dates for each customer
    allCustomers.forEach((customer) => {
      customer.created_date = formatDate(customer.created_date); // Format the created_date
      customer.previous_visit = formatDate(customer.previous_visit); // Format the  date
    });

    // Render the customersTable view with the fetched data
    res.render("./super/customersTable", {
      pageTitle: "All Customers",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allCustomers,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all customers tabble
exports.getAllSuppliers = async (req, res) => {

  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all suppliers from the Suppliers table
    const results = await query(`SELECT * FROM "Suppliers"`);
    const allSuppliers = results.rows; // PostgreSQL returns rows directly

    // Format dates for each supplier
    allSuppliers.forEach((supplier) => {
      supplier.created_date = formatDate(supplier.created_date); // Format the created_date
    });

    // Render the supplierTable view with the fetched data
    res.render("./super/supplierTable", {
      pageTitle: "All Suppliers",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allSuppliers,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all stores tabble
exports.getAllStores = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all stores from the Stores table
    const results = await query(`SELECT * FROM "Stores"`);
    const allStores = results.rows; // PostgreSQL returns rows directly

    // Render the storesTable view with the fetched data
    res.render("./super/storesTable", {
      pageTitle: "All Stores",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allStores,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all stores tabble
exports.getAllDiscounts = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all discounts from the Discount table
    const results = await query(`SELECT * FROM "Discount"`);
    const allDiscounts = results.rows; // PostgreSQL returns rows directly

    // Format dates in allDiscounts
    allDiscounts.forEach((discount) => {
      discount.Start_date = formatDate(discount.Start_date);
      discount.End_date = formatDate(discount.End_date);
    });

    // Render the discountTable view with the fetched data
    res.render("./super/discountTable", {
      pageTitle: "All Discounts",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allDiscounts,
    });

  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

// all cats
exports.getAllCategory = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all categories from the Category table
    const results = await query(`SELECT * FROM "Category"`);
    const allCategory = results.rows; // PostgreSQL returns rows directly

    // Render the categoryTable view with the fetched data
    res.render("./super/categoryTable", {
      pageTitle: "All categories",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allCategory,
    });
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all Products
exports.getAllShelfItems = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all products from the Products table, ordered by id in descending order
    const {rows:allProducts} = await query(`SELECT * FROM "Products" `);
  

  
    // Render the productsTable view with the fetched data
    res.render("./super/productsTable", {
      pageTitle: "All products",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allProducts,
    });
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all transac
exports.getAllTransactions = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all transactions from the Transactions table
    const results = await query(`SELECT * FROM "Transactions"`);
    const allTransactions = results.rows; // PostgreSQL returns rows directly

    // Format the TransactionDate for each transaction
    allTransactions.forEach((transaction) => {
      transaction.TransactionDate = formatDate(transaction.TransactionDate); // Assuming 'TransactionDate' is the date field
    });

    // Render the transactionTable view with the fetched data
    res.render("./super/transactionTable", {
      pageTitle: "All Transactions",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allTransactions,
    });
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all Inventory
exports.getAllInventory = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch inventory data from the PostgreSQL database
    const results = await query(`SELECT * FROM "inventory" `);
    const inventoryData = results.rows; // Use rows to directly get the data from the result

    // Format the dates
    inventoryData.forEach((inventory) => {
      inventory.created_date = formatDate(inventory.created_date);
      inventory.Manufacture_date = formatDate(inventory.Manufacture_date);
      inventory.Expire_date = formatDate(inventory.Expire_date);
    });

    // Calculate days left until expiry for each item
    const itemsWithDaysLeft = inventoryData.map((item) => {
      const today = new Date();
      const expiryDate = new Date(item.Expire_date);

      // Calculate the difference in milliseconds between expiry date and today's date
      const timeDifference = expiryDate.getTime() - today.getTime();

      // Convert the difference from milliseconds to days
      const daysLeft = Math.ceil(timeDifference / (1000 * 3600 * 24));

      return {
        id: item.id,
        manufacture_date: item.Manufacture_date,
        expiry_date: item.Expire_date,
        days_left: daysLeft,
      };
    });

    // Add the calculated days left to the inventory data
    const allInventory = inventoryData.map((item) => {
      const correspondingWatchData = itemsWithDaysLeft.find(
        (watchItem) => watchItem.id === item.id
      );
      return {
        ...item,
        watchData: correspondingWatchData,
      };
    });

    // Render the inventoryTable view with the processed data
    return res.render("./super/inventoryTable", {
      pageTitle: "All Inventory",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allInventory,
    });
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


// all Positions
exports.getAllPositions = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all positions from the PostgreSQL database
    const results = await query(`SELECT * FROM "Positions"`);
    const allPosition = results.rows; // Use rows to directly get the data from the result

    // Render the positionTable view with the retrieved data
    return res.render("./super/positionTable", {
      pageTitle: "All positions",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allPosition,
    });
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.getAllOrders = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(`SELECT * FROM "Orders" WHERE status != 'complete' `);
    const allOrders = JSON.parse(JSON.stringify(results.rows)); // Accessing the .rows property

    // Format dates for PostgreSQL
    allOrders.forEach((order) => {
      order.created_date = formatDate(order.created_date); // Assuming 'created_date' is the date field in your orders table
    });

    return res.render("./super/ordersTable", {
      pageTitle: "All Orders",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allOrders,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};


exports.getAllCanceledOrders = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(`SELECT * FROM "Orders" WHERE status = $1 `, ["canceled"]);
    const canceledResults = results.rows; // Directly accessing the rows

    return res.render("./super/canceledTable", {
      pageTitle: "All Canceled Orders",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      canceledResults,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};


exports.getOneCanceledOrder = async (req, res) => {
  const viewId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch the canceled  the "Orders" table
    const results = await query(`SELECT * FROM "Orders" WHERE id = $1 `, [viewId]);
    const canceledOrder = results.rows;

    if (canceledOrder.length === 0) {
      req.flash("error_msg", `Order not found`);
      return res.redirect("/super");
    }

    // Fetch the user who made the order
    const userMakingTheOrderResult = await query(`SELECT * FROM "Users" WHERE id = $1`, [canceledOrder[0].customer_id]);
    const userMakingTheOrder = userMakingTheOrderResult.rows[0];

    if (!userMakingTheOrder) {
      req.flash("error_msg", `User not found`);
      return res.redirect("/super");
    }

    const Fullname = `${userMakingTheOrder.First_name} ${userMakingTheOrder.Last_name}`;

    // Fetch the ordered items related to the sale from the "Order_products" table
    const orderedItems = await query(`SELECT * FROM "Order_Products" WHERE sale_id = $1`, [canceledOrder[0].sale_id]);
    const orderedItemsResults = orderedItems.rows;

    // Render the view with the fetched data
    return res.render("./super/canceledDetails", {
      pageTitle: `${Fullname} Canceled Orders`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      canceledResults: canceledOrder,
      orderedItemsResults,
      Fullname
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving canceled order: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.getAllLogisticCompany = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch all logistic companies from the "Logistics" table
    const results = await query(`SELECT * FROM "Logistics"`);
    const logisticsResults = results.rows;

    // Render the view with the fetched data
    return res.render("./super/logisticsCompanyTable", {
      pageTitle: "All logistic companies",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      logisticsResults,
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic companies: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.getOneLogisticCompany = async (req, res) => {
  const viewId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(`SELECT * FROM "Logistics" WHERE id = $1`, [viewId]);
    const logisticsResults = results.rows[0]; // Get the first row from the result

    return res.render("./super/logisticCompanyEditForm", {
      pageTitle: `Edit Company`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      logisticsResults,
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic company: ${error.message}`);
    return res.redirect("/super");
  }
};



exports.allLogisticDrivers = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch all users with the position 'Logistics' from the "Users" table
    const {rows:logisticsResults} = await query(`SELECT * FROM "Users" WHERE "position" = $1`, ['Logistics']);


    return res.render("./super/logisticUsersTable", {
      pageTitle: `Edit Logistics Driver`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      logisticsResults,
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving logistic drivers: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.asigneToCompany = async (req, res) => {

  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to get the user by ID from the "Users" table
    const userResult = await query(`SELECT * FROM "Users" WHERE id = $1`, [req.params.id]);
    const allUsers = userResult.rows; // Get the rows from the result

    // Query to get all logistics companies from the "Logistics" table
    const logisticsResult = await query(`SELECT * FROM "Logistics"`);
    const allLogistics = logisticsResult.rows; // Get the rows from the result

    // Render the form with the fetched data
    return res.render("./super/logisticsAsigneToCompanyForm", {
      pageTitle: `Add to Company Logistics`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allLogistics,
      allUsers
    });

  } catch (error) {
    req.flash("error_msg", `Error retrieving data: ${error.message}`);
    return res.redirect("/super");
  }

};


exports.addDriverToCompany = async (req, res) => {
  const editId = req.params.id;
  const { company } = req.body;

  if (!company) {
    req.flash("error_msg", `Please select a company before submitting`);
    return res.redirect(`/super/add-driver-to-company/${editId}`);
  }

  try {
    // Query to get logistics company details
    const logisticsResult = await query(`SELECT * FROM "Logistics" WHERE id = $1`, [company]);
    const logisticsResults = logisticsResult.rows;

    if (logisticsResults.length === 0) {
      req.flash("error_msg", `Logistics company not found`);
      return res.redirect(`/super/add-driver-to-company/${editId}`);
    }

    // Update the user with the selected logistics company
    await query(`UPDATE "Users" SET logistic_id = $1, logistics_company_name = $2 WHERE id = $3`, 
      [company, logisticsResults[0].name, editId]
    );

    req.flash("success_msg", `Successfully updated`);
    return res.redirect("/super/");
   
  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};



// get the for 

exports.createStorePage = (req, res) => {

  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/storesCreateForm",{
      pageTitle:"create store",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createDiscountPage = (req, res) => {

  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/discountCreateForm",{
      pageTitle:"create discount",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createCategoryPage = (req, res) => {


  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/categoryCreateForm",{
      pageTitle:"create category",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createSupplierPage = (req, res) => {


  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/supplierCreateForm",{
      pageTitle:"create  supplier",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createPositionPage = (req, res) => {
  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/positionCreateForm",{
      pageTitle:"create position",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createLogisticCompanyPage = (req, res) => {
  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;

  res.render("./super/logisticsCreateForm",{
      pageTitle:"create logistic",
      name: `${nameA} ${nameB}`,
      month:monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      stateData,
    }
  );

};
exports.createBrandPage = (req, res) => {
  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;
  res.render("./super/BrandCreateForm ",{
    pageTitle:"create brand",
    name: `${nameA} ${nameB}`,
    month:monthName,
    day: dayName,
    date: presentDay,
    year: presentYear,
});
};

exports.createRankPage = (req, res) => {
  let nameA = req.user.First_name;
  let nameB = req.user.Last_name;
  res.render("./super/rankAddPage",{
    pageTitle:"create rank",
    name: `${nameA} ${nameB}`,
    month:monthName,
    day: dayName,
    date: presentDay,
    year: presentYear,
});
};




exports.createInventoryPage = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch all suppliers
    const {rows:supplierData} = await query(`SELECT * FROM "Suppliers"`);

    // Fetch all stores
    const {rows:allStores} = await query(`SELECT * FROM "Stores"`);

    // Fetch all super admin users
    const {rows:superAdmin} = await query(`SELECT * FROM "Users" WHERE "userRole" = 'super' `);

    // Fetch all categories
    const {rows:categoryData} = await query(`SELECT * FROM "Category"`);

    if(categoryData.length <= 0){
      req.flash("warning_msg", "create in a category first")
      return res.redirect('/super/create-category')
    }

    // Fetch all brands
    const {rows:brandData} = await query(`SELECT * FROM "Brands"`);


    // Render the form
    res.render("./super/inventoryCreateForm", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      categoryData,
      supplierData,
      superAdmin,
      allStores,
      brandData
    });
    return 
  } catch (err) {
    req.flash("error_msg", `${err.message}`);
    return res.redirect("/super");
  }
};

exports.getAllBrand = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch all brands from the Brands table
    const {rows:brandResults} = await query(`SELECT * FROM "Brands"`);


    // Render the brandTable view
    res.render("./super/brandTable", {
      pageTitle: "All brad",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      brandResult: brandResults
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};

exports.editBrandPage = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch the brand data by id from the Brands table
    const {rows:brandData} = await query(`SELECT * FROM "Brands" WHERE id = $1`, [req.params.id]);

    // Render the BrandEdit view
    res.render("./super/BrandEdit", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      results:brandData
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};


exports.createNewBrand = async (req, res) => {
  const { brandName } = req.body;

  if (!brandName) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Check if the brand already exists
    const results = await query(`SELECT * FROM "Brands" WHERE "Name" = $1`, [brandName]);

    if (results.rows.length === 0) {
      // Insert new brand
      const newuuid = uuidv4()
      await query(`INSERT INTO "Brands" (id, "Name") VALUES ($1,$2)`, [newuuid, brandName]);

      req.flash("success_msg", `"${brandName}" added successfully!`);
      return res.redirect("/super/all-brands");
    }

    req.flash("error_msg", `"${brandName}" already exists!`);
    return res.redirect("/super/all-brands");

  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};

exports.updateBrand = async (req, res) => {
  const { brandName } = req.body;
  if (!brandName) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super/all-brands");
  }

  try {
    // Update the brand with the new name
    await query(`UPDATE "Brands" SET "Name" = $1 WHERE id = $2`, [brandName, req.params.id]);

    req.flash("success_msg", `"${brandName}" updated successfully!`);
    return res.redirect("/super/all-brands");

  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};


exports.getAllRanks = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch all brands from the Brands table
    const {rows:allRanks} = await query(`SELECT * FROM "ranks"`);


    // Render the brandTable view
    res.render("./super/ranksTable", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allRanks: allRanks
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};

exports.createNewRank = async (req, res) => {
  const { rankName,threshold } = req.body;

  if (!(rankName && threshold)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("back");
  }

  try {
    // Check if the rank already exists
    const { rows: nameResults } = await query(`SELECT * FROM "ranks" WHERE "name" = $1`, [rankName]);
const { rows: thresholdResults } = await query(`SELECT * FROM "ranks" WHERE "threshold" = $1`, [threshold]);



// Check if either name or threshold already exists
if (nameResults.length > 0) {
  req.flash("error_msg", `"${rankName}" already exists!`);
  return res.redirect("back");
} else if (thresholdResults.length > 0) {
  req.flash("error_msg", `Threshold already exists!`);
  return res.redirect("back");
} else {
  // Insert new rank only if both name and threshold do not exist
  const newuuid = uuidv4()

  const insertQuery = `
    INSERT INTO "ranks" (id, "name", "threshold") 
    VALUES ($1, $2, $3);
  `;

  const values = [newuuid, rankName, threshold];

  // Perform the insertion with a fresh query reference
  const insertResult = await query(insertQuery, values);

  req.flash("success_msg", `"${rankName}" added successfully!`);
  return res.redirect("/super");
}


  } catch (error) {
    req.flash("error_msg", `${error.message}`); 
    return res.redirect("/super");
  }
};

exports.updateRank = async (req, res) => {
  const { rankName,threshold } = req.body;

  if (!(rankName && threshold)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("back");
  }

  try {
    // Check if the rank already exists
    const { rows: nameResults } = await query(`SELECT * FROM "ranks" WHERE "name" = $1`, [rankName]);
const { rows: thresholdResults } = await query(`SELECT * FROM "ranks" WHERE "threshold" = $1`, [threshold]);



// Check if either name or threshold already exists
if (nameResults.length > 0) {
  req.flash("error_msg", `"${rankName}" already exists!`);
  return res.redirect("back");
} else if (thresholdResults.length > 0) {
  req.flash("error_msg", `Threshold already exists!`);
  return res.redirect("back");
} else {
  
  const updateQuery = `UPDATE "ranks" SET "name" = $1, "threshold" = $2 WHERE "id" = $3`;

const values = [rankName, threshold, req.params.id];


// Execute the query
const updateResult = await query(updateQuery, values);

  req.flash("success_msg", `"${rankName}" added successfully!`);
  return res.redirect("/super/all-ranks");
}
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};


exports.getExternalRiders = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch all riders from the drivers table
    const { rows: allExternalRiders } = await query(`SELECT * FROM "drivers"`);

    // Process each driver to add the total of relevant orders
    const updatedRiders = await Promise.all(
      allExternalRiders.map(async (rider) => {
        const { rows: orderCount } = await query(
          `SELECT COUNT(*) AS "shippedOrders"
           FROM "Orders"
           WHERE "rider_id" = $1 AND "pickup" = 'closed' AND "status" = 'shipped'`,
          [rider.id]
        );


        // Add the shipped order count to the rider object
        return {
          ...rider,
          shippedOrders: parseInt(orderCount[0].shippedOrders, 10) || 0,
        };
      })
    );

    // Render the driversTable view with updated rider data
    res.render("./super/driversTable", {
      pageTitle: "External Riders",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allExternalRiders: updatedRiders,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};


exports.getOneExternalRider = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch driver details by ID
    const { rows: driverDetails } = await query(`SELECT * FROM "drivers" WHERE id = $1`, [req.params.id]);
    
    // Fetch shipped orders for the driver
    const { rows: shippedOrders } = await query(
      `SELECT * FROM "Orders" WHERE "rider_id" = $1 AND "status" = $2`,
      [req.params.id, "shipped"]
    );

    // Render the driver view with fetched data
    res.render("./super/driversView", {
      pageTitle: "Driver Details",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      driverDetails,  // Simplified variable names
      shippedOrders
    });
  } catch (error) {
    req.flash("error_msg", `Error loading driver data: ${error.message}`);
    return res.redirect("/super");
  }
};



exports.approveRiderApplication = async (req, res) => {

  const newRiderId = req.params.id
  try {
    // Fetch all users with the role 'user'
    const {rows:results} = await query(`SELECT * FROM "drivers" WHERE "user_id" = $1`, [newRiderId]);
    const newRider = results[0] 


    const updateQuery = `UPDATE "drivers" SET "verified" = $1, "status" = $2 WHERE "user_id" = $3`;

    const values = [true, "approved", newRiderId];

          // Execute the query
      const updateResult = await query(updateQuery, values);

      const updateUserRoleQuery = `UPDATE "Users" SET "userRole" = $1 WHERE "id" = $2`;
      await query(updateUserRoleQuery, ['driver', newRiderId]);

      req.flash("success_msg", `"rider approved!`);
      return res.redirect("back");



  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.disapproveRiderApplication = async (req, res) => {

  const newRiderId = req.params.id
  try {
    // Fetch all users with the role 'user'
    const {rows:results} = await query(`SELECT * FROM "drivers" WHERE "user_id" = $1`, [newRiderId]);
    const newRider = results[0] // Extract data using .rows


    const updateQuery = `UPDATE "drivers" SET "verified" = $1, "status" = $2 WHERE "user_id" = $3`;
    const values = [false, "removed", newRiderId];

          // Execute the query
      const updateResult = await query(updateQuery, values);

      const updateUserRoleQuery = `UPDATE "Users" SET "userRole" = $1 WHERE "id" = $2`;
      await query(updateUserRoleQuery, ['user', newRiderId]);

      req.flash("success_msg", `"rider removed!`);
      return res.redirect("back");


  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};
exports.banRiderForever = async (req, res) => {

  const newRiderId = req.params.id
  try {
    // Fetch all users with the role 'user'
    const {rows:results} = await query(`SELECT * FROM "drivers" WHERE "user_id" = $1`, [newRiderId]);
    const newRider = results[0] // Extract data using .rows


    const updateQuery = `DELETE FROM "drivers" WHERE "user_id" = $1`;
    const values = [newRiderId];

          // Execute the query
      const updateResult = await query(updateQuery, values);

      const updateUserRoleQuery = `UPDATE "Users" SET "userRole" = $1 WHERE "id" = $2`;
      await query(updateUserRoleQuery, ['user', newRiderId]);

      req.flash("success_msg", `"rider baned!!`);
      return res.redirect("/super/all-external-riders");


  } catch (error) {
    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};

// createReturn

exports.createReturn = (req, res) => {

  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;
  return res.render("./super/returnForm", {
    pageTitle: "return item",
    name: `${userFirstName} ${userLastName}`,
    month: monthName,
    day: dayName,
    date: presentDay,
    year: presentYear,

  });
};
// single item
exports.getInventoryById = async (req, res) => {
  const singleId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch inventory by ID using parameterized query
    const results = await query(`SELECT * FROM "inventory" WHERE id = $1`, [singleId]);

    if (results.rows.length <= 0) {
      req.flash('warning_msg', 'Item does not exist in our inventory');
      return res.redirect('/super');
    }

    let allInventory = results.rows;
    const {rows:tags} = await query('SELECT * FROM tags');

    // const {rows:productTags} = await query('SELECT * FROM inventory_tags');
    const { rows: productTags } = await query(
      'SELECT tag_id FROM inventory_tags WHERE inventory_id = $1',
      [singleId]
  )
    const tagIds = productTags.map(tag => tag.tag_id);

    // Reformat the dates for display
    allInventory.forEach((inventory) => {
      inventory.created_date = formatDate(inventory.created_date);
      inventory.Manufacture_date = formatDate(inventory.Manufacture_date);
      inventory.Expire_date = formatDate(inventory.Expire_date);
    });

    return res.render("./super/inventorySingle", {
      pageTitle: `${allInventory[0].Product_name} | ${allInventory[0].Brand_name}`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allInventory:allInventory[0],
      tags,
      productTags,
      productId:singleId,
      tagIds
    });

  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};

// add price page
exports.getAddpricePage = async (req, res) => {
  const singleId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch inventory by ID using a parameterized query
    const results = await query(`SELECT * FROM "inventory" WHERE id = $1`, [singleId]);

    if (results.rows.length <= 0) {
      req.flash('warning_msg', 'Item does not exist in our inventory');
      return res.redirect('back');
    }


    const {rows: shelfResult} = await query(`SELECT * FROM "Products" WHERE "inventory_id" = $1`, [singleId]);

    if (shelfResult.length > 0) {
      req.flash('warning_msg', 'Item exist in shelf already');
      return res.redirect('back');
    }
    let allInventory = results.rows;

    // Reformat the dates for display
    allInventory.forEach((inventory) => {
      inventory.created_date = formatDate(inventory.created_date);
      inventory.Manufacture_date = formatDate(inventory.Manufacture_date);
      inventory.Expire_date = formatDate(inventory.Expire_date);
    });

    return res.render("./super/addPricePage", {
      pageTitle: `${allInventory[0].Product_name} | ${allInventory[0].Brand_name}`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allInventory,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};

exports.getAddpriceUpdatePage = async (req, res) => {
  const singleId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch inventory by ID using a parameterized query
    const results = await query(`SELECT * FROM "inventory" WHERE id = $1`, [singleId]);

    if (results.rows.length <= 0) {
      req.flash('warning_msg', 'Item does not exist in our inventory');
      return res.redirect('/super');
    }

    let allInventory = results.rows;

    // Reformat the dates for display
    allInventory.forEach((inventory) => {
      inventory.created_date = formatDate(inventory.created_date);
      inventory.Manufacture_date = formatDate(inventory.Manufacture_date);
      inventory.Expire_date = formatDate(inventory.Expire_date);
    });

    return res.render("./super/addPriceUpdatePage", {
      pageTitle: `${allInventory[0].Product_name} | ${allInventory[0].Brand_name}`,
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allInventory,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};

//  at the counter page
exports.adminCounter = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch all categories
    const results = await query(`SELECT * FROM "Category"`);

    let allCategory = results.rows; // Access rows directly

    res.render("./super/superCounter", {
      pageTitle: "At the counter",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allCategory,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};

// invoice of an order
exports.invoice = async (req, res) => {
  const saleId = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Query to fetch order products
    const orderProductsResult = await query(`SELECT * FROM "Order_Products" WHERE sale_id = $1`, [saleId]);
    const newOrderProducts = orderProductsResult.rows;

    // Query to fetch sale details
    const saleResult = await query(`SELECT * FROM "Sales" WHERE sale_id = $1`, [saleId]);
    const newSale = saleResult.rows;

    // Render invoice page with fetched data
    return res.render("./super/saleInvoice", {
      pageTitle: "Invoice",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      newSale,
      newOrderProducts,
      totalSubtotal: newSale[0]?.total_amount || 0, // Handle case where newSale might be empty
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};








// post req

exports.createNewCategory = async (req, res) => {
  const { Category_name, Desc,image_name } = req.body;

  try {
    // Check if the category already exists
    const checkResult = await query(`SELECT * FROM "Category" WHERE "Category_name" = $1`, [Category_name]);

    if (checkResult.rows.length <= 0) {
      // Insert new category
      const newuuid = uuidv4()

      await query(`INSERT INTO "Category" ("CategoryID", "Category_name", "details", "image") VALUES ($1, $2,$3,$4)`, [newuuid, Category_name, Desc,image_name]);
      req.flash("success_msg", `"${Category_name}" added successfully!`);
      return res.redirect("/super/all-categories");
    }

    req.flash("error_msg", `"${Category_name}" already exists!`);
    return res.redirect("/super/all-categories");
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};

exports.createNewSupplier = async (req, res) => {
  const { First_name, Last_name, email, Phone, Address, Business_name } = req.body;

  // Check for missing fields
  if (!(First_name && Last_name && email && Phone && Address && Business_name)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Check if supplier with the same business name already exists
    const checkResult = await query(`SELECT * FROM "Suppliers" WHERE "Business_name" = $1`, [Business_name]);

    if (checkResult.rows.length <= 0) {
      // Insert new supplier
      const newuuid = uuidv4()
      await query(`INSERT INTO "Suppliers" (id, "First_name", "Last_name", "Business_name", "email", "Phone", "Address", "created_date") VALUES ($1, $2, $3, $4, $5, $6, $7,$8)`, 
      [newuuid, First_name, Last_name, Business_name, email, Phone, Address, new Date()]);
      
      req.flash("success_msg", `"${Business_name}" added successfully!`);
      return res.redirect("/super/all-supplier");
    }

    req.flash("error_msg", `"${Business_name}" already exists!`);
    return res.redirect("/super/all-supplier");
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


exports.createNewStore = async (req, res) => {
  const { Branch_Name, Branch_state, Branch_lga, Branch_address } = req.body;

  // Check for missing fields
  if (!(Branch_Name && Branch_state && Branch_lga && Branch_address)) {
    req.flash("error_msg", "Enter all fields before submitting Store");
    return res.redirect("/super");
  }

  try {
    // Check if store with the same branch name already exists
    const checkResult = await query(`SELECT * FROM "Stores" WHERE "store_name" = $1`, [Branch_Name]);

    if (checkResult.rows.length <= 0) {
      // Insert new store
      const newuuid = uuidv4()
      await query(`INSERT INTO "Stores" (id, "store_name", "store_address", "state", "lga") VALUES ($1, $2, $3, $4,$5)`, 
      [newuuid, Branch_Name, Branch_address, Branch_state, Branch_lga]);
      
      req.flash("success_msg", `"${Branch_Name}" added successfully!`);
      return res.redirect("/super/all-stores");
    }

    req.flash("error_msg", `"${Branch_Name}" already exists!`);
    return res.redirect("/super/all-stores");
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


exports.createNewDiscount = async (req, res) => {
  const { Discount_name, Discount_Provider, Discount_Percentage, Start_Date, End_Date } = req.body;

  // Check for missing fields
  if (!(Discount_name && Discount_Provider && Discount_Percentage && Start_Date && End_Date)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Check if discount with the same name already exists
    const checkResult = await query(`SELECT * FROM "Discount" WHERE "Discount_name" = $1`, [Discount_name]);

    if (checkResult.rows.length <= 0) {
      // Insert new discount
      const newuuid = uuidv4()
      await query(`INSERT INTO "Discount" (id, "Discount_name", "Discount_provider", "Discount_percentage", "Start_date", "End_date") VALUES ($1, $2, $3, $4, $5,$6)`, 
      [newuuid, Discount_name, Discount_Provider, Discount_Percentage, Start_Date, End_Date]);

      req.flash("success_msg", `"${Discount_name}" added successfully!`);
      return res.redirect("/super/all-discounts");
    }

    req.flash("error_msg", `"${Discount_name}" already exists!`);
    return res.redirect("/super/all-discounts");
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};



exports.createNewInventory = async (req, res) => {
  let supplierId;
  let filename;
  let brandID;
  let errors = [];
  
  // Setting the image name from the uploaded file
  if (req.file) {
    filename = req.file.filename;
  } else {
    filename = "default.jpg";
  }

  const { 
    Category_name, Brand_name, Product_name, Purchase_price, Supplier_name,
    Payment_method, Reciever_name, Delivery_method, QTY_recieved, total_in_pack, Expire_date, Cost_of_delivery, Total_damaged, details 
  } = req.body;

  // Ensure all fields are filled
  if (
    !(
      Category_name && Brand_name && Product_name && Purchase_price &&
      Supplier_name && Payment_method && Reciever_name && Delivery_method &&
      QTY_recieved && total_in_pack &&  Expire_date &&
      Cost_of_delivery && Total_damaged
    )
  ) {
    errors.push({ msg: 'enter all fields' });
    const nameA = req.user.First_name;
    const nameB = req.user.Last_name;
       // Fetch all suppliers
       const {rows:supplierData} = await query(`SELECT * FROM "Suppliers"`);

       // Fetch all stores
       const {rows:allStores} = await query(`SELECT * FROM "Stores"`);
   
       // Fetch all super admin users
       const {rows:superAdmin} = await query(`SELECT * FROM "Users" WHERE "userRole" = 'super' `);
   
       // Fetch all categories
       const {rows:categoryData} = await query(`SELECT * FROM "Category"`);
   
       if(categoryData.length <= 0){
         req.flash("warning_msg", "create in a category first")
         return res.redirect('/super/create-category')
       }
   
       // Fetch all brands
       const {rows:brandData} = await query(`SELECT * FROM "Brands"`);
       

       return res.render("./super/inventoryCreateForm", {
         pageTitle: "Welcome",
         errors,
         name: `${nameA} ${nameB}`,
         month: monthName,
         day: dayName,
         date: presentDay,
         year: presentYear,
         categoryData,
         supplierData,
         superAdmin,
         allStores,
         brandData,
        //  availaible fields enteed

        Category_name, Brand_name, Product_name, Purchase_price, Supplier_name,
        Payment_method, Reciever_name, Delivery_method, QTY_recieved, total_in_pack, 
         Expire_date, Cost_of_delivery, Total_damaged, details 
       });
        
  }

  try {
    // Get the Brand ID
    const brandResult = await query(`SELECT * FROM "Brands" WHERE "Name" = $1`, [Brand_name]);
    if (brandResult.rows.length > 0) {
      brandID = brandResult.rows[0].id;
    } else {
      brandID = 0;
    }

    // Get the Supplier ID
    const supplierResult = await query(`SELECT * FROM "Suppliers" WHERE "Business_name" = $1`, [Supplier_name]);
    if (supplierResult.rows.length > 0) {
      supplierId = supplierResult.rows[0].id;
    } else {
      supplierId = 0;
    }

    // Get the Category ID
    const categoryResult = await query(`SELECT * FROM "Category" WHERE "Category_name" = $1`, [Category_name]);
    if (categoryResult.rows.length === 0) {
      req.flash('error_msg', 'Category not found');
      return res.redirect("/super/create-inventory");
    }
    const categoryId = categoryResult.rows[0].CategoryID;



    // Insert into inventory
    const newuuid = uuidv4()

    await query(`INSERT INTO "inventory" (id,
      "Category_name", "Brand_name", "Product_name", "Purchase_price", "category_id",
      "supplier_id", "brand_id", "Supplier_name", "Payment_method", "Reciever_name",
      "Delivery_method", "QTY_recieved", "total_in_pack", "Expire_date",
      "Cost_of_delivery", "Total_damaged", "created_date", "activate", "image", "details"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`, [ newuuid,
      Category_name, Brand_name, Product_name, Purchase_price, categoryId, supplierId, brandID, 
      Supplier_name, Payment_method, Reciever_name, Delivery_method, QTY_recieved, total_in_pack, 
       Expire_date, Cost_of_delivery, Total_damaged, new Date(), false, filename, details
    ]);

    req.flash("success_msg", `"${Product_name}" added successfully!`);
    return res.redirect("/super/all-inventory");
    
  } catch (error) {
    // Debugging: Log the error
    console.error("SQL Error:", error.message);

    req.flash("error_msg", `Error: ${error.message}`);
    return res.redirect("/super");
  }
};








exports.createNewCustomer = async (req, res) => {
  const { First_name, Last_name, email, Phone, Address } = req.body;

  if (!(First_name && Last_name && email && Phone && Address)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Check if customer already exists
    const checkResult = await query(
      `SELECT * FROM "Customers" WHERE "First_name" = $1 AND "Last_name" = $2`,
      [First_name, Last_name]
    );

    if (checkResult.rows.length <= 0) {
      // Insert new customer
      const newuuid = uuidv4()

      await query(
        `INSERT INTO "Customers" (id,
          "First_name", "Last_name", "email", "Phone", "Address", "created_date", "previous_visit", "spending"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [ newuuid,
          First_name, Last_name, email, Phone, Address,
          new Date(), new Date(), 0
        ]
      );

      req.flash("success_msg", `"${First_name}" added successfully!`);
      return res.redirect("/super");
    } else {
      req.flash("error_msg", `"${First_name}" already exists!`);
      return res.redirect("/super");
    }
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


exports.createNewPosition = async (req, res) => {
  const { Position_name, Salary, Job_description } = req.body;

  if (!(Position_name && Salary && Job_description)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("back");
  }

  try {
    // Check if position already exists
    const checkResult = await query(
      `SELECT * FROM "Positions" WHERE "Position_name" = $1`,
      [Position_name]
    );

    if (checkResult.rows.length <= 0) {
      // Insert new position
      const newuuid = uuidv4()
      await query(
        `INSERT INTO "Positions" (id,
          "Position_name", "Salary", "Job_description"
        ) VALUES ($1, $2, $3, $4)`,
        [newuuid, Position_name, Salary, Job_description]
      );

      req.flash("success_msg", `"${Position_name}" added successfully!`);
      return res.redirect("/super/all-positions");
    } else {
      req.flash("error_msg", `"${Position_name}" already exists!`);
      return res.redirect("/super");
    }
  } catch (error) {
    console.log(error);
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};

exports.createNewLogistics = async (req, res) => {
  const { name, phone, email, address } = req.body;

  if (!(name && phone && email && address)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Check if logistics provider already exists
    const checkResult = await query(
      `SELECT * FROM "Logistics" WHERE "name" = $1`,
      [name]
    );

    if (checkResult.rows.length <= 0) {
      // Insert new logistics provider
      const newuuid = uuidv4()
      await query(
        `INSERT INTO "Logistics" (id,
          "name", "email", "address", "phone"
        ) VALUES ($1, $2, $3, $4, $5)`,
        [newuuid, name, email, address, phone]
      );

      req.flash("success_msg", `"${name}" added successfully!`);
      return res.redirect("/super");
    } else {
      req.flash("error_msg", `"${name}" already exists!`);
      return res.redirect("/super");
    }
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


exports.editLogisticsComp = async (req, res) => {
  const editID = req.params.id;
  const { name, phone, email, address } = req.body;

  // Check if all required fields are provided
  if (!(name && phone && email && address)) {
    req.flash("error_msg", "Enter all fields before submitting");
    return res.redirect("/super");
  }

  try {
    // Update the logistics provider's information
    const updateResult = await query(
      `UPDATE "Logistics" 
       SET "name" = $1, "phone" = $2, "email" = $3, "address" = $4 
       WHERE "id" = $5`,
      [name, phone, email, address, editID]
    );


    // Check if the update was successful
    if (updateResult.rowCount === 0) {
      req.flash("error_msg", "No logistics provider found with the given ID.");
      return res.redirect("/super");
    }

        // select all from users with id and change name
        const checkUsersResult = await query(`SELECT * FROM "Users" WHERE "logistic_id" = $1`,[editID]);
           if (checkUsersResult.rowCount > 0) {
             const updateUsersResult = await query(`UPDATE "Users" SET "logistics_company_name" = $1 WHERE "logistic_id" = $2`,[name, editID]);
       
           } else {
            //  console.log("No users found with this logistic_id.");
           }
       

    req.flash("success_msg", "Logistics provider updated successfully.");
    return res.redirect("/super");
  } catch (error) {
    req.flash("error_msg", `Error updating logistics provider: ${error.message}`);
    return res.redirect("/super");
  }
};




exports.returnProcessor = async (req, res) => {
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;
  const { searchId } = req.body;

  try {
    // Fetch order products where sale_id matches and status is 'sold'
    const productsResult = await query(
      `SELECT * FROM "Order_Products" WHERE "sale_id" = $1 AND "status" = 'sold'`,
      [searchId]
    );
    const productsData = productsResult.rows;

    // Fetch sales data where sale_id matches
    const salesResult = await query(
      `SELECT * FROM "Sales" WHERE "sale_id" = $1`,
      [searchId]
    );
    const salesData = salesResult.rows;

    // Render the return processor page with fetched data
    return res.render("./super/returnProcessor", {
      pageTitle: "Return Details",
      errors: [], // Ensure `errors` is initialized as an empty array
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      productsData,
      salesData
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Changed to error.message for better error handling
    return res.redirect("/super");
  }
};


// price form to add to shelf
exports.addToShelfForSale = async (req, res) => {
  const updateID = req.params.id;
  const { price } = req.body;

  // Check if price is provided
  if (!price) {
    req.flash("error_msg", `Enter price before submitting to add to shelf.`);
    return res.redirect("/super");
  }

  try {
    // Retrieve the data from the inventory table
    const inventoryResult = await query(
      `SELECT * FROM "inventory" WHERE "id" = $1`,
      [updateID]
    );
    const inventoryDataFromDb = inventoryResult.rows;

    // Check if the product is already in the Products table
    const productResult = await query(
      `SELECT * FROM "Products" WHERE "inventory_id" = $1`,
      [updateID]
    );

    if (productResult.rows.length <= 0) {
      const totalInStock = inventoryDataFromDb[0].QTY_recieved * inventoryDataFromDb[0].total_in_pack;
      const totalOnShelf = totalInStock - inventoryDataFromDb[0].Total_damaged;

      const productDataToAdd = {
        details: inventoryDataFromDb[0].details,
        Brand_name: inventoryDataFromDb[0].Brand_name,
        ProductName: inventoryDataFromDb[0].Product_name,
        category: inventoryDataFromDb[0].Category_name,
        inventory_id: inventoryDataFromDb[0].id,
        UnitPrice: price,
        StockQuantity: inventoryDataFromDb[0].QTY_recieved,
        total_in_pack: inventoryDataFromDb[0].total_in_pack,
        total_on_shelf: totalOnShelf,
        created_date: sqlDate,
        activate: true,
        image: inventoryDataFromDb[0].image,
        category_id: inventoryDataFromDb[0].category_id
      };

      // Insert into Products table
      await query(
        `INSERT INTO "Products" (id, "details", "Brand_name", "ProductName", "category", "inventory_id", "UnitPrice", "StockQuantity", "total_in_pack", "total_on_shelf", "created_date", "activate", "image", "category_id")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          uuidv4(),
          productDataToAdd.details,
          productDataToAdd.Brand_name,
          productDataToAdd.ProductName,
          productDataToAdd.category,
          productDataToAdd.inventory_id,
          productDataToAdd.UnitPrice,
          productDataToAdd.StockQuantity,
          productDataToAdd.total_in_pack,
          productDataToAdd.total_on_shelf,
          productDataToAdd.created_date,
          productDataToAdd.activate,
          productDataToAdd.image,
          productDataToAdd.category_id
        ]
      );

      // Update Products table with price
      await query(
        `UPDATE "Products" SET "UnitPrice" = $1, "activate" = ${true} WHERE "inventory_id" = $2`,
        [price, updateID]
      );

      // Update inventory table
      await query(
        `UPDATE "inventory" SET "activate" = ${true} WHERE "id" = $1`,
        [updateID]
      );

      req.flash("success_msg", `Price added, now available to be sold on the shelf.`);
      return res.redirect("/super");

    } else {
      // Update existing entry in inventory and Products table
      await query(
        `UPDATE "inventory" SET "activate" = ${true} WHERE "id" = $1`,
        [updateID]
      );
  
    
        let oldPrice 
        if (productResult.rows[0].UnitPrice) {
          oldPrice = productResult.rows[0].UnitPrice;
        }else{
          oldPrice = 0.00
        }
      
        // Update the price in the Products table
        await query(
          `UPDATE "Products" SET "activate" = ${true}, "UnitPrice" = $1, "old_price" = $2 WHERE "inventory_id" = $3`,
          [price, oldPrice, updateID]
        );

   
      req.flash("success_msg", `New price of ${price} added and status is activated.`);
      return res.redirect("/super");
    }

  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};








exports.updatePrice = async (req, res) => {
  const editID = req.params.id;
  const { price } = req.body;

  if (!price) {
    req.flash("error_msg", `Enter new price`);
    return res.redirect(`/super/all-products/`);
  }

  try {
    const { rows: productResult } = await query(
      `SELECT * FROM "Products" WHERE "inventory_id" = $1`,
      [editID]
    );
    // Ensure there's a product result to avoid errors
    if (productResult.length > 0) {
      const oldPrice = productResult[0].UnitPrice;
      
      const percentageChange = ((price - oldPrice) / oldPrice) * 100;
      
  

      await query(
        `UPDATE "Products" SET "UnitPrice" = $1, "old_price" = $2, percentage = $3 WHERE "inventory_id" = $4`,
        [price, oldPrice,percentageChange, editID]
      );

      // check in cart
      const { rows: cartResult } = await query(`SELECT * FROM "Cart" WHERE "product_id" = $1`,[productResult[0].id]);

      if (cartResult.length > 0) {
      
        // Update the price in the Products table
        await query(
          `UPDATE "Cart" SET "price_per_item" = $1,"subtotal" = $2 WHERE "product_id" = $3`,
          [price, price * cartResult[0].quantity, productResult[0].id]
        );
      }
    }


    req.flash("success_msg", `Price updated successfully!`);
    return res.redirect("/super/all-products");

  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};

// activate on inventory
exports.remove = async (req, res) => {
  const pageId = req.params.id;

  try {
    await query(
      `UPDATE "inventory" SET "status" = $1, "activate" = $2 WHERE "id" = $3`,
      ['verified',true, pageId]
    );

    req.flash("success_msg", `Status is verified`);
    return res.redirect("/super/all-inventory");

  } catch (error) {
    req.flash("error_msg", `${error.message}`);
    return res.redirect("/super");
  }
};

// form
exports.storeEdit = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(`SELECT * FROM "Stores" WHERE "id" = $1`,[editID]);

    if (results.rows.length <= 0) {
      req.flash("warning_msg", `No store found with ID ${editID}`);
      return res.redirect("/super");
    }

    const storeData = results.rows;
    // If you need to fetch stateData, do so here and include it in the render options

    return res.render("./super/storesEditForm", {
      pageTitle: "Edit Store",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      storeData,
      stateData: stateData 
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.rankEdit = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(
      `SELECT * FROM "ranks" WHERE "id" = $1`,
      [editID]
    );

    if (results.rows.length <= 0) {
      req.flash("warning_msg", `No store found with ID ${editID}`);
      return res.redirect("/super");
    }

    const rankData = results.rows[0];
    // If you need to fetch stateData, do so here and include it in the render options

    return res.render("./super/ranksEditForm", {
      pageTitle: "Edit rank",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      rankData,
      // stateData: stateData // Uncomment if stateData is being fetched and passed
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.editDiscount = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    const results = await query(
      `SELECT * FROM "Discount" WHERE "id" = $1`,
      [editID]
    );

    if (results.rows.length <= 0) {
      req.flash("error_msg", `No discount found with ID ${editID}`);
      return res.redirect("/super");
    }

    const discountData = results.rows[0]; // Extract the first result if it's an array

    return res.render("./super/discountEditForm", {
      pageTitle: "Edit Discount",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      discountData,
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};







exports.editSupplier = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch supplier data by ID using parameterized query
    const results = await query(
      `SELECT * FROM "Suppliers" WHERE "id" = $1`,
      [editID]
    );

    if (results.length === 0) {
      req.flash("error_msg", `No supplier found with ID ${editID}`);
      return res.redirect("/super");
    }

    const supplierData = results.rows[0]; // Extract the supplier data

    return res.render("./super/supplierEditForm", {
      pageTitle: "Edit Supplier",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      supplierData,
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};



exports.editCategory = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch category data by ID using parameterized query
    const results = await query(
      `SELECT * FROM "Category" WHERE "CategoryID" = $1`,
      [editID]
    );

    if (results.length <= 0) {
      req.flash("error_msg", `No category found with ID ${editID}`);
      return res.redirect("/super");
    }

    const categoryData = results.rows; // Extract the first result

    return res.render("./super/categoryEditForm", {
      pageTitle: "Edit Category",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      categoryData,
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.editInventory = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Fetch all necessary data with parameterized queries
    const [supplierData, allUsersData, categoryDataResult, inventoryDataResults, brandData] = await Promise.all([
      query(`SELECT * FROM "Suppliers"`),
      query(`SELECT * FROM "Users" WHERE "userRole" = $1`, ["super"]),
      query(`SELECT * FROM "Category"`),
      query(`SELECT * FROM "inventory" WHERE "id" = $1`, [editID]),
      query(`SELECT * FROM "Brands"`)
    ]);

    // Convert results to JSON if needed
    const allSuppliers = JSON.parse(JSON.stringify(supplierData.rows));
    const allBrands = JSON.parse(JSON.stringify(brandData.rows));
    const allUsers = JSON.parse(JSON.stringify(allUsersData.rows));
    const categoryData = JSON.parse(JSON.stringify(categoryDataResult.rows));
    const inventoryData = JSON.parse(JSON.stringify(inventoryDataResults.rows));

    // Ensure inventory data is not empty and extract the first item
    const inventoryItem = inventoryData.length > 0 ? inventoryData[0] : null;

    if (!inventoryItem) {
      req.flash("error_msg", "Inventory item not found");
      return res.redirect("/super");
    }

    // Render the inventory edit form
    res.render("./super/inventoryEditForm", {
      pageTitle: "Edit Inventory",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      inventoryData: inventoryItem,
      categoryData,
      allUsers,
      supplierData:allSuppliers,  
      stateData,
      allBrands
    });

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.editPosition = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;

  try {
    // Retrieve all necessary data
    const [allPositionsResult, allStoresResult, allUsersResult, categoryResults, positionData] = await Promise.all([
      query(`SELECT * FROM "Positions"`),
      query(`SELECT * FROM "Stores"`),
      query(`SELECT * FROM "Users"`),
      query(`SELECT * FROM "Category"`),
      query(`SELECT * FROM "Positions" WHERE id = $1`, [editID])
    ]);

  


    // Check if the specific position exists
    if (positionData.rows.length <= 0) {
      req.flash("error_msg", `Position not found`);
      return res.redirect("/super");
    }

    // Render the position edit form
    return res.render("./super/positionEditForm", {
      pageTitle: "Edit Position",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      positionData: positionData.rows, // Ensure single item is passed
 
    });
     
  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.editEmployee = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;
  
  try {
    // Retrieve all necessary data
    const [allPositions, allStores, allUsersResult] = await Promise.all([
      query(`SELECT * FROM "Positions"`),
      query(`SELECT * FROM "Stores"`),
      query(`SELECT * FROM "Users" WHERE id = $1`, [editID]) // Use $1 for parameterized queries (PostgreSQL style)
    ]);
    

    // Check if the user exists
    if (allUsersResult.rows.length === 0) {
      req.flash("error_msg", `Employee not found`);
      return res.redirect("/super");
    }

    // Check if the user is an admin
    if (allUsersResult.rows[0].userRole === "super") {
      req.flash("warning_msg", `Cannot edit admin user`);
      return res.redirect("back");
    }

    const allUsers = allUsersResult.rows[0];

    // Set the date variables (define them appropriately)
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const presentDay = now.getDate();
    const presentYear = now.getFullYear();

    // Render the employee edit form
    return res.render("./super/employeeEditUpgrade", {
      pageTitle: "Edit Employee",
      name: `${userFirstName} ${userLastName}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      allPositions: allPositions.rows, // Add rows if necessary for result formatting
      allUsers,
      allStores: allStores.rows, // Add rows if necessary for result formatting
    });
    
  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};






// put section
exports.updateEmployee = async (req, res) => {
  const updateID = req.params.id;
  const { store_name, position } = req.body;

  if (!(store_name && position )) {
    req.flash("error_msg", `Enter all fields before updating Employee`);
    return res.redirect("/super/all-employees");
  }

  try {
    // Get the ID for the position
    const positionResults = await query(
      `SELECT id FROM "Positions" WHERE "Position_name" = $1`,
      [position]
    );
    

    if (positionResults.length === 0) {
      req.flash('error_msg', `Position not found`);
      return res.redirect('/super');
    }
    
    const positionId = positionResults.rows[0].id;

    // Get the ID for the store
    const storeResults = await query(
      `SELECT id FROM "Stores" WHERE "store_name" = $1`,
      [store_name]
    );

    if (storeResults.length === 0) {
      req.flash('error_msg', `Store not found`);
      return res.redirect('/super');
    }

    const storeId = storeResults.rows[0].id;

    // Update the employee record
    await query(
      `UPDATE "Users" SET "store_name" = $1, "store_id" = $2, "position_id" = $3, "position" = $4 WHERE "id" = $5`,
      [store_name, storeId, positionId, position, updateID]
    );

    req.flash("success_msg", `Employee updated successfully!`);
    return res.redirect("/super/all-employees");

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.editNewStore = async (req, res) => {
  const updateID = req.params.id;
  const { Branch_Name, Branch_state, Branch_lga, Branch_address } = req.body;

  if (!(Branch_Name && Branch_state && Branch_lga && Branch_address)) {
    req.flash("error_msg", `Enter all fields before submitting`);
    return res.redirect(`/super/edit-store/${updateID}`);
  }

  try {
    // Check if the store exists
    const storeResult = await query(
      `SELECT * FROM "Stores" WHERE id = $1`,
      [updateID]
    );

    if (storeResult.length === 0) {
      req.flash("error_msg", `Store not found`);
      return res.redirect("/super/all-stores");
    }

    // Update store details
    await query(
      `UPDATE "Stores" SET "store_name" = $1, "store_address" = $2, "state" = $3, "lga" = $4 WHERE "id" = $5`,
      [Branch_Name, Branch_address, Branch_state, Branch_lga, updateID]
    );

    req.flash("success_msg", `"${Branch_Name}" edited successfully!`);
    return res.redirect("/super/all-stores");
  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.editNewDiscount = async (req, res) => {
  const updateID = req.params.id;
  const {
    Discount_name,
    Discount_Provider,
    Discount_Percentage,
    Start_Date,
    End_Date,
  } = req.body;

  if (!(Discount_name && Discount_Provider && Discount_Percentage)) {
    req.flash("error_msg", `Enter all fields before submitting`);
    return res.redirect(`/super/edit-discount/${updateID}`);
  }

  if (Start_Date && !End_Date) {
    req.flash("error_msg", `Enter End Date if Start Date is provided`);
    return res.redirect(`/super/edit-discount/${updateID}`);
  }

  try {
    // Check if the discount exists
    const discountResult = await query(
      `SELECT * FROM "Discount" WHERE id = $1`,
      [updateID]
    );

    if (discountResult.rows.length === 0) {
      req.flash("error_msg", `Discount not found`);
      return res.redirect("/super/all-discounts");
    }

    // Update discount details
    await query(
      `UPDATE "Discount" SET "Discount_name" = $1, "Discount_provider" = $2, "Discount_percentage" = $3, "Start_date" = $4, "End_date" = $5 WHERE id = $6`,
      [Discount_name, Discount_Provider, Discount_Percentage, Start_Date, End_Date, updateID]
    );

    req.flash("success_msg", `"${Discount_name}" edited successfully!`);
    return res.redirect("/super/all-discounts");
  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.editNewSupplier = async (req, res) => {
  const editID = req.params.id;
  const { First_name, Last_name, email, Phone, Address } = req.body;
  
  if (!(First_name && Last_name && email && Phone && Address)) {
    req.flash("error_msg", `Enter all fields before submitting`);
    return res.redirect(`/super/edit-supplier/${editID}`);
  }
  
  try {
    // Check if the supplier exists
    const results = await query(
      `SELECT * FROM "Suppliers" WHERE id = $1`,
      [editID]
      );
      

      if (results.rows.length === 0) {
        req.flash("error_msg", `Supplier not found!`);
        return res.redirect("/super/all-supplier");
      }
    
    // Update supplier details
   const updateResult =  await query(
      `UPDATE "Suppliers" SET "First_name" = $1, "Last_name" = $2, "email" = $3, "Phone" = $4, "Address" = $5 WHERE id = $6`,
      [First_name, Last_name, email, Phone, Address, editID]
    );

    if (updateResult.rowCount === 0) {
      console.log('No rows updated. Check if the id exists.');
    } 

    req.flash("success_msg", `Supplier updated successfully!`);
    return res.redirect("/super/all-supplier");
  } catch (error) {
    console.log(error);
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect(`/super/edit-supplier/${editID}`);
  }
};

exports.editNewCategory = async (req, res) => {
  const editID = req.params.id;
  const { Category_name, Desc,image_name } = req.body;

  if (!(Category_name && Desc)) {
    req.flash("error_msg", `Enter all fields before submitting`);
    return res.redirect(`/super/edit-category/${editID}`);
  }

  try {
    // Check if the category exists
    const results = await query(
      `SELECT * FROM "Category" WHERE "CategoryID" = $1`,
      [editID]
    );

    if (results.rows.length === 0) {
      req.flash("error_msg", `No category found`);
      return res.redirect(`/super/all-categories`);
    }

    const updateData = {
      Category_name,
      details: Desc,
    };

    // Update category
    await query(
      `UPDATE "Category" SET "Category_name" = $1, "details" = $2, "image" = $3 WHERE "CategoryID" = $4`,
      [Category_name, Desc,image_name, editID]
    );

    // Update inventory if category is in use
    const {rows:selectedInventory} = await query(
      `SELECT * FROM "inventory" WHERE "category_id" = $1`,
      [editID]
    );

    
    if (selectedInventory.length > 0) {
      await query(
        `UPDATE "inventory" SET "Category_name" = $1 WHERE "category_id" = $2`,
        [Category_name, editID]
      );

      // Update products if category is in use
      const {rows:allProductsResults} = await query(
        `SELECT * FROM "Products" WHERE "category_id" = $1`,
        [editID]
      );

      if (allProductsResults.length > 0) {
        await query(
          `UPDATE "Products" SET "category" = $1 WHERE "category_id" = $2`,
          [Category_name, editID]
        );
        req.flash("success_msg", `Updated category, inventory, and shelf successfully!`);
      } else {
        req.flash("success_msg", `Updated category and inventory successfully!`);
      }
    } else {
      req.flash("success_msg", `Updated category alone!`);
    }

    return res.redirect("/super/all-categories");

  } catch (error) {
    req.flash("error_msg", `An error occurred: ${error.message}`);
    return res.redirect(`/super/edit-category/${editID}`);
  }
};




exports.editNewInventory = async (req, res) => {
  const editID = req.params.id;
  const {
    Category_name,
    Brand_name,
    Product_name,
    Purchase_price,
    Supplier_name,
    Payment_method,
    Reciever_name,
    Delivery_method,
    QTY_recieved,
    total_in_pack,
    Expire_date,
    Cost_of_delivery,
    Total_damaged,
    details,
    specifications
  } = req.body;

  // Ensure all required fields are provided
  if (
    !(
      Category_name &&
      Brand_name &&
      Product_name &&
      Purchase_price &&
      Supplier_name &&
      Payment_method &&
      Reciever_name &&
      Delivery_method &&
      QTY_recieved &&
      total_in_pack &&
      Expire_date &&
      Cost_of_delivery &&
      Total_damaged &&
      details &&
      specifications
    )
  ) {
    req.flash("error_msg", `Enter all fields before submitting, check if you entered the date again`);
    return res.redirect(`/super/edit-inventory/${editID}`);
  }


  let newStatus;
  const currentDate = new Date();
  const expiryDate = new Date(Expire_date); 
  
  if (expiryDate > currentDate) {
    newStatus = "not-expired";
  } else {
    newStatus = "expired";
  }
  

  try {

    // Get the Brand ID
    const brandResult = await query(`SELECT * FROM "Brands" WHERE "Name" = $1`, [Brand_name]);
    if (brandResult.rows.length > 0) {
      brandID = brandResult.rows[0].id;
    } else {
      brandID = 0;
    }

    // Get the Supplier ID
    const supplierResult = await query(`SELECT * FROM "Suppliers" WHERE "Business_name" = $1`, [Supplier_name]);
    if (supplierResult.rows.length > 0) {
      supplierId = supplierResult.rows[0].id;
    } else {
      supplierId = 0;
    }

    // Get the Category ID
    const categoryResult = await query(`SELECT * FROM "Category" WHERE "Category_name" = $1`, [Category_name]);
    if (categoryResult.rows.length === 0) {
      req.flash('error_msg', 'Category not found');
      return res.redirect('/super');
    }
    const categoryId = categoryResult.rows[0].CategoryID;



    const productResults = await query(`SELECT * FROM "Products" WHERE "inventory_id" = $1`,[editID]);

    // If the item is not in the Products table, update only the inventory
    if (productResults.rows.length === 0) {
      await query(
        `UPDATE "inventory" SET "Category_name" = $1, "Brand_name" = $2, "Product_name" = $3, "Purchase_price" = $4, "Supplier_name" = $5, "Payment_method" = $6, "Reciever_name" = $7, "Delivery_method" = $8, "QTY_recieved" = $9, "total_in_pack" = $10, "Expire_date" = $11, "Cost_of_delivery" = $12, "Total_damaged" = $13, "details" = $14, "category_id"=$15,"supplier_id"=$16, "brand_id" = $17,"expired" = $18, specifications = $19 WHERE id = $20`,
        [
          Category_name,
          Brand_name,
          Product_name,
          Purchase_price,
          Supplier_name,
          Payment_method,
          Reciever_name,
          Delivery_method,
          QTY_recieved,
          total_in_pack,
          Expire_date,
          Cost_of_delivery,
          Total_damaged,
          details,categoryId, supplierId, brandID,newStatus,specifications,
          editID
        ]
      );

      req.flash("success_msg", `"${Product_name}" updated successfully for inventory alone !`);
      return res.redirect("/super/all-inventory");
    }

    // If the item is in the Products table, update both Products and inventory
    await query(`UPDATE "Products" SET "category" = $1, "Brand_name" = $2, "ProductName" = $3, "details" = $4, "StockQuantity" = $5, "total_in_pack" = $6,"category_id" =$7,"status" = $8, specifications = $9 WHERE "inventory_id" = $10`,
      [
        Category_name,
        Brand_name,
        Product_name,
        details,
        QTY_recieved,
        total_in_pack,categoryId,newStatus,specifications,
        editID
      ]
    );

    await query(`UPDATE "inventory" SET "Category_name" = $1, "Brand_name" = $2, "Product_name" = $3, "Purchase_price" = $4, "Supplier_name" = $5, "Payment_method" = $6, "Reciever_name" = $7, "Delivery_method" = $8, "QTY_recieved" = $9, "total_in_pack" = $10, "Expire_date" = $11, "Cost_of_delivery" = $12, "Total_damaged" = $13, "details" = $14, "category_id"=$15,"supplier_id"=$16, "brand_id" = $17,"expired"= $18, specifications =$19 WHERE id = $20`,
      [
        Category_name,
        Brand_name,
        Product_name,
        Purchase_price,
        Supplier_name,
        Payment_method,
        Reciever_name,
        Delivery_method,
        QTY_recieved,
        total_in_pack,
        
        Expire_date,
        Cost_of_delivery,
        Total_damaged,
        details,categoryId, supplierId, brandID, newStatus, specifications,
        editID
      ]
    );

         // Update cart if present
         const {rows:allCartsResults} = await query(`SELECT * FROM "Cart" WHERE "product_id" = $1`,[productResults.rows[0].id]);
         if (allCartsResults.length > 0) {
          await query(`UPDATE "Cart" SET "product_name" = $1 WHERE "product_id" = $2`,
            [Product_name, productResults.rows[0].id]
          );
         }
         const {rows:orderedProductResults} = await query(`SELECT * FROM "Order_Products" WHERE "product_id" = $1`,[productResults.rows[0].id]);
         if (orderedProductResults.length > 0) {
          await query(`UPDATE "Order_Products" SET "name" = $1 WHERE "product_id" = $2`,
            [Product_name, productResults.rows[0].id]
          );
         }


    req.flash("success_msg", `"${Product_name}" updated successfully! on shelf too`);
    return res.redirect("/super/all-inventory");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.editNewPosition = async (req, res) => {
  const editID = req.params.id;
  const { Position_name, Salary, Job_description } = req.body;

  // Ensure all required fields are provided
  if (!(Position_name && Salary && Job_description)) {
    req.flash("error_msg", `Enter all fields before submitting`);
    return res.redirect(`/super/edit-position/${editID}`);
  }

  const updateData = {
    Position_name,
    Salary,
    Job_description,
  };

  try {
    // Update the position data
    await query(
      `UPDATE "Positions" SET "Position_name" = $1, "Salary" = $2, "Job_description" = $3 WHERE id = $4`,
      [Position_name, Salary, Job_description, editID]
    );

    req.flash("success_msg", `Position updated successfully!`);
    return res.redirect("/super/all-positions");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.resolveSale = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch the sale details
    const salesResults = await query(`SELECT * FROM "Sales" WHERE id = $1`, [editID]);
    if (salesResults.rows.length === 0) {
      req.flash("error_msg", "Sale not found");
      return res.redirect("/super/all-sales");
    }
    
    const salesData = salesResults.rows[0];
    
    // Fetch products related to this sale
    const {rows:orderResults} = await query(`SELECT * FROM "Order_Products" WHERE "sale_id" = $1`, [salesData.sale_id]);
    
    // Aggregate product quantities
    const productQuantities = {};
    orderResults.forEach(({ product_id, quantity }) => {
      productQuantities[product_id] = (productQuantities[product_id] || 0) + quantity;
    });

    // Update stock quantities and handle errors
    const promises = Object.entries(productQuantities).map(async ([product_id, quantity]) => {
      const {rows:shelfResults} = await query(`SELECT "total_on_shelf" FROM "Products" WHERE id = $1`, [product_id]);
      if (shelfResults.length === 0) {
        req.flash("error_msg", `Product with id ${product_id} not found`);
        throw new Error(`Product with id ${product_id} not found`);
      }

      const currentShelfQuantity = shelfResults[0].total_on_shelf;
      const newQty = currentShelfQuantity - quantity;

      if (newQty < 0) {
        req.flash("error_msg", `Not enough stock for product id ${product_id}`);
        throw new Error(`Not enough stock for product id ${product_id}`);
      }

      await query(`UPDATE "Products" SET "total_on_shelf" = $1 WHERE id = $2`, [newQty, product_id]);
    });

    await Promise.all(promises);

    // Update sale status
    await query(`UPDATE "Sales" SET "status" = $1 WHERE id = $2`, ['resolved', editID]);

    req.flash("success_msg", "Sale has been resolved");
    return res.redirect("/super/sales");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.flagProduct = async (req, res) => {
  const editID = req.params.id;
  const deactivate = false

  try {
    // Update the inventory status to deactivate
    await query(`UPDATE "inventory" SET "activate" = $1 WHERE id = $2`, [deactivate, editID]);

    // Update the products status to deactivate
    await query(`UPDATE "Products" SET "activate" = $1 WHERE "inventory_id" = $2`, [deactivate, editID]);

    const {rows:shelfResults} = await query(`SELECT * FROM "Products" WHERE inventory_id = $1`, [editID]);

    if (shelfResults.length > 0) {
      
      await query(`DELETE FROM  "Cart"  WHERE "product_id" = $1`, [shelfResults[0].id]);
    } 

    req.flash("warning_msg", `Product deactivated successfully!`);
    return res.redirect("/super/all-products");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.unflagProduct = async (req, res) => {
  const editID = req.params.id;
  const activate = true;

  try {
    
    // Update the inventory status to activate
    await query(`UPDATE "inventory" SET "activate" = $1 WHERE id = $2`, [activate, editID]);

    // Update the products status to activate
    await query(`UPDATE "Products" SET "activate" = $1 WHERE "inventory_id" = $2`, [activate, editID]);
    

    req.flash("success_msg", "Product activated successfully!");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};




// showcase functions
exports.addToShowcase = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch product details
    const results = await query(`SELECT * FROM "Products" WHERE id = $1`, [editID]);

    if (results.rows.length === 0) {
      req.flash("error_msg", "Product not found.");
      return res.redirect("/super/all-products");
    }

    const product = results.rows[0];

    // Check if product is expired or has insufficient stock
    if (product.total_on_shelf <= 0 || product.status === "expired") {
      req.flash("warning_msg", "Product is either out of stock or expired.");
      return res.redirect("/super/all-products");
    }

    // Check if the product is already on showcase
    if (product.showcase === "yes") {
      req.flash("warning_msg", "Product is already on showcase.");
      return res.redirect("back");
    }

    // Check if the product is activated
    if (product.activate === true) {
      // Update product to add to showcase
      await query(`UPDATE "Products" SET "showcase" = $1 WHERE id = $2`, ["yes", editID]);
      req.flash("success_msg", "Product added to showcase successfully!");
      return res.redirect("/super/all-products");
    } else {
      req.flash("warning_msg", "Activate the product before adding to showcase.");
      return res.redirect("/super/all-products");
    }

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.removeFromShowcase = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch product details
    const results = await query(`SELECT * FROM "Products" WHERE id = $1`, [editID]);

    if (results.rows.length === 0) {
      req.flash("error_msg", "Product not found.");
      return res.redirect("back");
    }

    const product = results.rows[0];

    // Check if the product is not on showcase
    if (product.showcase === "no") {
      req.flash("warning_msg", "Product is not on showcase.");
      return res.redirect("back");
    }

    // Update product to remove from showcase
    await query(`UPDATE "Products" SET "showcase" = $1 WHERE id = $2`, ["no", editID]);
    req.flash("success_msg", "Product removed from showcase successfully!");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};


// exclusive functions
exports.addToExclusivee = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch product details
    const results = await query(`SELECT * FROM "Products" WHERE id = $1`, [editID]);

    if (results.rows.length === 0) {
      req.flash("error_msg", "Product not found.");
      return res.redirect("/super/all-products");
    }

    const product = results.rows[0];

    // Check if product is expired or has insufficient stock
    if (product.total_on_shelf <= 0 || product.status === "expired") {
      req.flash("warning_msg", "Product is either out of stock or expired.");
      return res.redirect("/super/all-products");
    }

    // Check if the product is already on showcase
    if (product.is_exclusive === true) {
      req.flash("warning_msg", "Product is already on exclusive.");
      return res.redirect("back");
    }

    // Check if the product is activated
    if (product.activate === true) {
      // Update product to add to showcase
      await query(`UPDATE "Products" SET "is_exclusive" = $1 WHERE id = $2`, [true, editID]);
      req.flash("success_msg", "Product is exclusive!");
      return res.redirect("/super/all-products");
    } else {
      req.flash("warning_msg", "Activate the product before adding to showcase.");
      return res.redirect("/super/all-products");
    }

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.removeFromExclusive = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch product details
    const results = await query(`SELECT * FROM "Products" WHERE id = $1`, [editID]);

    if (results.rows.length === 0) {
      req.flash("error_msg", "Product not found.");
      return res.redirect("back");
    }

    const product = results.rows[0];

    // Check if the product is not on showcase
    if (product.showcase === false) {
      req.flash("warning_msg", "Product is not exclusive.");
      return res.redirect("back");
    }

    // Update product to remove from showcase
    await query(`UPDATE "Products" SET "is_exclusive" = $1 WHERE id = $2`, [false, editID]);
    req.flash("success_msg", "Product removed from exclusive successfully!");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

// delete req
exports.deleteStore = async (req, res) => {
  const editID = req.params.id;

  try {
    // Delete the store with the given ID
    const result = await query(`DELETE FROM "Stores" WHERE id = $1`, [editID]);

    // Check if any rows were affected
    if (result.rowCount === 0) {
      req.flash("warning_msg", "Store not found or already deleted.");
      return res.redirect("back");
    }

    req.flash("success_msg", "Store has been removed successfully.");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.deleteDiscount = async (req, res) => {
  const editID = req.params.id;

  try {
    // Delete the discount with the given ID
    const result = await query(`DELETE FROM "Discount" WHERE id = $1`, [editID]);

    // Check if any rows were affected
    if (result.rowCount === 0) {
      req.flash("warning_msg", "Discount not found or already deleted.");
      return res.redirect("back");
    }

    req.flash("success_msg", "Discount has been removed successfully.");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.deleteEmployee = async (req, res) => {
  const editID = req.params.id;

  try {
    // Check if the employee exists and their role
    const results = await query(`SELECT * FROM "Users" WHERE id = $1`, [editID]);
    if (results.rows.length === 0) {
      req.flash("error_msg", "Employee not found.");
      return res.redirect("back");
    }

    const user = results.rows[0];

    if (user.userRole === "super") {
      req.flash("warning_msg", "Cannot delete this account!");
      return res.redirect("back");
    }

    // Proceed to delete the employee
    await query(`DELETE FROM "Users" WHERE id = $1`, [editID]);
    req.flash("success_msg", "Employee has been removed.");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};




exports.deleteSupplier = async (req, res) => {
  const editID = req.params.id;

  try {
    // Delete the supplier using parameterized query
    await query(`DELETE FROM "Suppliers" WHERE id = $1`, [editID]);
    req.flash("success_msg", "Item has been removed.");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.deleteCategory = async (req, res) => {
  const editID = req.params.id;

  try {
    // Delete the category using parameterized query for PostgreSQL
    await query(`DELETE FROM "Category" WHERE "CategoryID" = $1`, [editID]);
    req.flash("success_msg", "Item has been removed.");
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Server error: ${error.message}`);
    return res.redirect("/super");
  }
};
exports.deleteInventory = async (req, res) => {
  const editID = req.params.id;

  try {
    const imageDirectory = path.join(__dirname, '../public/uploads/');
    
    // Fetch inventory data using a parameterized query for PostgreSQL
    const results = await query(`SELECT * FROM "inventory" WHERE "id" = $1`, [editID]);
    const inventoryData = results.rows[0]; // Access the first row of the result set
    const unlinkPath = path.join(imageDirectory, inventoryData.image);
    
    
    // Check if the file exists before attempting to delete it
    if (fs.existsSync(unlinkPath)) {
      try {
        fs.unlinkSync(unlinkPath);
      } catch (error) {
        req.flash("error_msg", `Could not delete image: ${error.message}`);
        return res.redirect("back");
      }
    } else {
      req.flash("warning_msg", "Image file does not exist.");
    }

    // Delete the inventory record
    await query(`DELETE FROM "inventory" WHERE "id" = $1`, [editID]);

    // Check if the product exists and delete it
    const {rows:productResults} = await query(`SELECT * FROM "Products" WHERE "inventory_id" = $1`, [editID]);

    if (productResults.length <= 0) {
      req.flash("success_msg", `Item has been removed only from inventory`);
      return res.redirect("back");
    }

    const {rows:cartResults} = await query(`SELECT * FROM "Cart" WHERE "product_id" = $1`, [productResults[0].id]);

    if (cartResults.length > 0) {
      await query(`DELETE FROM "Cart" WHERE "product_id" = $1`, [productResults[0].id]);
    }
    
    await query(`DELETE FROM "Products" WHERE "inventory_id" = $1`, [editID]);
    req.flash("success_msg", `Item has been removed from inventory and store`);
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.deletePosition = async (req, res) => {
  const editID = req.params.id;

  try {

    // get user with such position and update them to "user"
    const {rows:userResults} = await query(`SELECT * FROM "Users" WHERE "position_id" = $1`, [editID]);

    if (userResults.length > 0) {
      const positionId = null;
      const position = null;
      const userRole = "user";
      await query(`UPDATE "Users" SET "position_id" = $1, "position" = $2, "userRole" = $3 WHERE "position_id" = $4`, [positionId, position, userRole, editID]);
    }
    // Delete the position record using a parameterized query for PostgreSQL
    await query(`DELETE FROM "Positions" WHERE "id" = $1`, [editID]);
    req.flash("success_msg", `Item has been removed`);
    return res.redirect("back");

  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.deleteLogisticCompany = async (req, res) => {
  const editID = req.params.id;

  try {
    // Use a parameterized query with $1 for PostgreSQL
    await query(`DELETE FROM "Logistics" WHERE "id" = $1`, [editID]);
    req.flash("success_msg", `Item has been removed`);
    return res.redirect("back");

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};






exports.deleteBrand = async (req, res) => {
  const editID = req.params.id;

  try {
    // Use a parameterized query with $1 for PostgreSQL
    await query(`DELETE FROM "Brands" WHERE "id" = $1`, [editID]);
    req.flash("success_msg", `Item has been removed`);
    return res.redirect("back");

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.deleteRank = async (req, res) => {
  const editID = req.params.id;

  try {
    // Use a parameterized query with $1 for PostgreSQL
    await query(`DELETE FROM "ranks" WHERE "id" = $1`, [editID]);
    req.flash("success_msg", `Item has been removed`);
    return res.redirect("back");

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};


// view order
exports.getSingleOrder = async (req, res) => {
  const editID = req.params.id;
  const userFirstName = req.user.First_name;
  const userLastName = req.user.Last_name;
  let errors = []
  try {
    // Fetch the order data
    const {rows:orderData} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [editID]);

    
    if (orderData.length === 0) {
      req.flash("error_msg", "No item found with this ID");
      return res.redirect("/super");
    }

    // Format the date if needed
    orderData.forEach((order) => {
      order.created_date = formatDate(order.created_date); // Assuming formatDate is a function you've defined
    });

    const saleID = orderData[0].sale_id;

    // Fetch products associated with the sale
    const {rows:productBought} = await query(`SELECT * FROM "Order_Products" WHERE "sale_id" = $1`, [saleID]);
    
    const {rows:trancactionData} = await query(`SELECT * FROM "Transactions" WHERE "id" = $1`, [orderData[0].transaction_id]);
    let transactionID = trancactionData
    
    // Fetch logistics and riders data
    const {rows:ridersData} = await query(`SELECT * FROM "drivers" WHERE "verified" = $1`, [true]);
    const {rows:logisticsDrivers} = await query(`SELECT * FROM "Logistics"`);
    
    


    return res.render("./super/orderSingle", {
      msg:errors,
      pageTitle: "Order Details",
      name: `${userFirstName} ${userLastName}`,
      month: monthName, // Ensure these variables are defined in your scope
      day: dayName,
      date: presentDay,
      year: presentYear,
      logisticsDrivers,
      ridersData,
      orderData,
      transactionID,
      productBought,
    });

  } catch (error) {
    console.log(error);
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};

exports.confirmOrder = async (req, res) => {
  const editID = req.params.id;

  try {
    // Fetch order details
    const {rows:thatOrder} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [editID]);
    if (thatOrder.length === 0) {
      req.flash("error_msg", "No record found for that order");
      return res.redirect("/super");
    }

    
    if (thatOrder[0].status === "canceled") {
      req.flash("error_msg", "Order status is 'canceled'");
      return res.redirect("/super/all-orders");
    }
    
    const saleID = thatOrder[0].sale_id;
    const customerId = thatOrder[0].customer_id;
    // fetchhh userr rank
    const {rows:thatUserWithOrder} = await query(`SELECT * FROM "Users" WHERE "id" = $1`, [customerId]);
    if (thatUserWithOrder.length === 0) {
      req.flash("error_msg", "No Customer found with that order");
      return res.redirect("/super");
    }

    const totalSpentOnThisOrder = parseFloat(thatOrder[0].total_amount) + parseFloat(thatOrder[0].shipping_fee);
    const rank = thatUserWithOrder[0].rank

    const cashBack = calculateCashback(parseFloat(thatOrder[0].total_amount),rank); 
    
    // Fetch order products
    const {rows:orderResults} = await query(`SELECT * FROM "Order_Products" WHERE "sale_id" = $1`, [saleID]);
    
    
    // Check availability of each product
    const availabilityPromises = orderResults.map(async (productBought) => {
      const {rows:shelfResults} = await query(`SELECT "total_on_shelf" FROM "Products" WHERE "id" = $1`, [productBought.product_id]);

      
      if (shelfResults.length === 0) {
        throw new Error(`Product with id ${productBought.product_id} not found`);
      }
      
      const currentShelfQuantity = shelfResults[0].total_on_shelf;
      if (currentShelfQuantity <= 0) {
        throw new Error(`Product "${productBought.name}" is out of stock`);

        // set product to refund
      }
    });
    
    await Promise.all(availabilityPromises);
    
    // Proceed with confirmation if all products are available
    if (thatOrder[0].status === "incomplete") {
      const {rows:thatSale} = await query(`SELECT * FROM "Sales" WHERE "sale_id" = $1`, [saleID]);
      if (thatSale.length > 0) {
        req.flash("warning_msg", "This order has already been confirmed");
        return res.redirect("/super/new-orders");
      }
      
      
      // Insert into Sales table
      const newuuid = uuidv4()
      await query(`
      INSERT INTO "Sales" (id, "store_name", "store_id", "sale_type", "sale_id", "created_date", "Discount_applied", "attendant_id", "total_amount", "Payment_type", "shipping_fee", "status") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      newuuid,
      null, 
      null, 
      "order", 
      saleID, 
      new Date(), // Replace with your preferred date format if needed
      0, 
      0, 
      parseFloat(thatOrder[0].total_amount),
      thatOrder[0].Payment_type, 
      parseFloat(thatOrder[0].shipping_fee), 
      "waiting"
    ]);
    

      // Update Order_Products and Orders tables
      await query(`UPDATE "Order_Products" SET "status" = 'waiting' WHERE "sale_id" = $1 AND "status" = 'pending'`, [saleID]);
      await query(`UPDATE "Orders" SET "status" = 'waiting' WHERE "id" = $1`, [editID]);

      // Update user spending and cashback
      const {rows:userResults} = await query(`SELECT * FROM "Users" WHERE "id" = $1`, [customerId]);
      
      if (userResults.length === 0) {
        req.flash("error_msg", "User not found");
        return res.redirect("/super");
      }

      const buyingUser = userResults[0];
      const newUserSpending = parseFloat(buyingUser.spending) + totalSpentOnThisOrder;

      const newCashBack = parseFloat(buyingUser.cashback) + cashBack;

      await query(`UPDATE "Users" SET "spending" = $1, "cashback" = $2 WHERE "id" = $3`, [newUserSpending, newCashBack, customerId]);
      const notificationNewuuid = uuidv4()
      await query('INSERT INTO "notifications" (id, "user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4,$5)',[notificationNewuuid, customerId, `Your Order Has been confirmed.`, 'success', false]);

      req.flash("success_msg", "Order has been confirmed! Status is set to 'waiting' (to be shipped)");
      res.redirect(`/super/view-order/${editID}`);
    } else {
      req.flash("warning_msg", "Check order status to treat");
      res.redirect(`/super/view-order/${editID}`);
    }
  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect("/super");
  }
};


exports.shipWithCompanyDriver = async (req, res) => {
  const editID = req.params.id;
  const driver = req.body.logistics;

  
  if (!driver) {
    req.flash("warning_msg", "Please select a driver");
    return res.redirect(`/super/view-order/${editID}`);
  }
  const trimedDrivervalue = driver.trim()


  try {
    // Fetch driver details
    const {rows:results} = await query(`SELECT * FROM "Logistics" WHERE "name" = $1`, [`${trimedDrivervalue}`]);
    if (results.length <= 0) {
      req.flash("warning_msg", "Driver not found");
      return res.redirect(`/super/view-order/${editID}`);
    }

    const dispatch = results[0];
    const dispatchEmail = dispatch.email;
    const dispatchCompanyName = dispatch.name;
    const dispatchPhone = dispatch.phone;
    const dispatchId = dispatch.id;

    // Fetch order details
    const {rows:orderResults} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [editID]);
    if (orderResults.length === 0) {
      req.flash("error_msg", "No record found for that order");
      return res.redirect("/super");
    }

    const thatOrder = orderResults[0];
    const saleID = thatOrder.sale_id;

    // Update sales, order products, and orders tables
    await query(`UPDATE "Sales" SET "status" = 'unresolved' WHERE "sale_id" = $1`, [saleID]);
    await query(`UPDATE "Order_Products" SET "status" = 'shipped' WHERE "sale_id" = $1`, [saleID]);
    await query(`UPDATE "Orders" SET "status" = 'shipped', "driver" = $1, "driver_email" = $2, "driver_phone" = $3, "driver_id" = $4, "pickup" = $5 WHERE "id" = $6`, [
      dispatchCompanyName,
      dispatchEmail,
      dispatchPhone,
      dispatchId,
      "closed",
      editID
    ]);

    const notificationNewuuid = uuidv4()
    await query('INSERT INTO "notifications" (id, "user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4,$5)',[notificationNewuuid, thatOrder.customer_id, `Your Order Has been Shhipped!.`, 'success', false]);
    req.flash("success_msg", "Order has been shipped! Status is set to shipped (resolved)");
    return res.redirect("/super/sales");

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect(`/super`);
  }
};

exports.shipWithRider = async (req, res) => {
  const orderID = req.params.id;
  const rider = req.body.rider;

  if (!rider) {
    req.flash("warning_msg", "Please select a rider");
    return res.redirect(`/super/view-order/${orderID}`);
  }

  try {
    // Fetch rider details
    const {rows:results} = await query(`SELECT * FROM "drivers" WHERE "companyName" = $1`, [rider]);
    if (results.length === 0) {
      req.flash("error_msg", "Driver not found");
      return res.redirect(`/super/view-order/${orderID}`);
    }

    const dispatch = results[0];
    const dispatchEmail = dispatch.companyEmail;
    const dispatchCompanyName = dispatch.companyName;
    const dispatchPhone = dispatch.companyPhone;
    const dispatchId = dispatch.id;
    const dispatchUserId = dispatch.user_id;

    // Fetch order details
    const {rows:orderResults} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [orderID]);
    if (orderResults.length === 0) {
      req.flash("error_msg", "No record found for that order");
      return res.redirect("/super");
    }

    const thatOrder = orderResults[0];
    const saleID = thatOrder.sale_id;
    const thatOrderCustomerId = thatOrder.customer_id;

    if (thatOrderCustomerId == dispatchUserId) {
      req.flash("error_msg", "goods belong to that rider, ship with someone else");
      return res.redirect("back");
    }
    
    // Update Sales
    await query(`UPDATE "Sales" SET "status" = 'unresolved' WHERE "sale_id" = $1`, [saleID]);

    // Update Order_Products
    await query(`UPDATE "Order_Products" SET "status" = 'shipped' WHERE "sale_id" = $1`, [saleID]);

    // Update Orders
    await query(`UPDATE "Orders" SET "status" = 'shipped', "rider_company_name" = $1, "rider_email" = $2, "rider_phone" = $3, "rider_id" = $4, "pickup" = 'closed' WHERE "id" = $5`, [
      dispatchCompanyName,
      dispatchEmail,
      dispatchPhone,
      dispatchId,
      orderID
    ]);

    const notificationNewuuid = uuidv4()
    await query('INSERT INTO "notifications" (id, "user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4, $5)',[notificationNewuuid, thatOrder.customer_id, `Your Order Has been Shipped.`, 'success', false]);
    req.flash("success_msg", "Order has been shipped! Status is set to shipped (to be received then resolved)");
    return res.redirect(`/super/sales`);

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect(`/super`);
  }
};


exports.shipWithNewRider = async (req, res) => {
  const orderID = req.params.id;
  const rider = req.body.rider;

  if (!rider) {
    req.flash("warning_msg", "Please select a rider");
    return res.redirect(`/super/view-order/${orderID}`);
  }

  try {
    // Fetch rider details
    const {rows:results} = await query(`SELECT * FROM "drivers" WHERE "companyName" = $1`, [rider]);
    if (results.length === 0) {
      req.flash("error_msg", "Driver not found");
      return res.redirect(`/super/view-order/${orderID}`);
    }

    const dispatch = results[0];
    const dispatchEmail = dispatch.companyEmail;
    const dispatchCompanyName = dispatch.companyName;
    const dispatchPhone = dispatch.companyPhone;
    const dispatchId = dispatch.id;
    const dispatchUserId = dispatch.user_id;

    // Fetch order details
    const {rows:orderResults} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [orderID]);
    if (orderResults.length === 0) {
      req.flash("error_msg", "No record found for that order");
      return res.redirect("/super");
    }

    const thatOrderCustomerId = orderResults[0].customer_id;

    if (orderResults[0].rider_company_name === rider) {
      req.flash("error_msg", "can not reassign to same rider twice");
      return res.redirect("back");
    }

    if (thatOrderCustomerId == dispatchUserId) {
      req.flash("error_msg", "item(s) belong to that rider, ship with someone else");
      return res.redirect("back");
    }


    // Update Orders
    await query(`UPDATE "Orders" SET "rider_company_name" = $1, "rider_email" = $2, "rider_phone" = $3, "rider_id" = $4 WHERE "id" = $5`, [
      dispatchCompanyName,
      dispatchEmail,
      dispatchPhone,
      dispatchId,
      orderID
    ]);

        // Update Orders
        await query(`UPDATE "Orders" SET "driver_id" = $1, "driver" = $2, "driver_phone" = $3, "driver_email" = $4 WHERE "id" = $5`, [
          null,
          null,
          null,
          null,
          orderID
        ]);

    req.flash("success_msg", "Order has been reassigned");
    return res.redirect(`/super/sales`);

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect(`/super`);
  }
};

exports.shipWithNewCompanyDriver = async (req, res) => {
  const orderID = req.params.id;
  const rider = req.body.logistics;

  const trimedDrivervalue = rider.trim()

  if (!rider) {
    req.flash("warning_msg", "Please select a rider");
    return res.redirect(`/super/view-order/${orderID}`);
  }

  try {
    // Fetch rider details
    const {rows:results} = await query(`SELECT * FROM "Logistics" WHERE "name" = $1`, [trimedDrivervalue]);
    if (results.length === 0) {
      req.flash("error_msg", "Driver not found");
      return res.redirect(`/super/view-order/${orderID}`);
    }

    const dispatch = results[0];
    const dispatchEmail = dispatch.email;
    const dispatchCompanyName = dispatch.name;
    const dispatchPhone = dispatch.phone;
    const dispatchId = dispatch.id;

    // Fetch order details
    const {rows:orderResults} = await query(`SELECT * FROM "Orders" WHERE "id" = $1`, [orderID]);
    if (orderResults.length === 0) {
      req.flash("error_msg", "No record found for that order");
      return res.redirect("/super");
    }


    if (orderResults[0].driver === rider) {
      req.flash("error_msg", "can not reassign to same driver twice");
      return res.redirect("/super");
    }



    // Update Orders
    await query(`UPDATE "Orders" SET "rider_company_name" = $1, "rider_email" = $2, "rider_phone" = $3, "rider_id" = $4, "pickup" = $5 WHERE "id" = $6`, [
      null,
      null,
      null,
      null,
      "closed",
      orderID
    ]);

        // Update Orders
        await query(`UPDATE "Orders" SET "driver_id" = $1, "driver" = $2, "driver_phone" = $3, "driver_email" = $4 WHERE "id" = $5`, [
          dispatchId,
          dispatchCompanyName,
          dispatchPhone,
          dispatchEmail,
          orderID
        ]);

    req.flash("success_msg", "Order has been reassigned to new logistic driver");
    return res.redirect(`/super/sales`);

  } catch (error) {
    req.flash('error_msg', `Error from server: ${error.message}`);
    return res.redirect(`/super`);
  }
};



exports.updateImage = async (req, res) => {

  const uploadId = req.params.id;
  let filename = req.file ? req.file.filename : "default.jpg";
  

  try {
    // Fetch products with the given inventory_id
    const {rows:productResults} = await query(`SELECT * FROM "Products" WHERE "inventory_id" = $1`, [uploadId]);

    if (productResults.length > 0) {
      // Update the product image
      await query(`UPDATE "Products" SET "image" = $1 WHERE "inventory_id" = $2`, [filename, uploadId]);
      // Update cart if present
      const {rows:allCartsResults} = await query(`SELECT * FROM "Cart" WHERE "product_id" = $1`,[productResults[0].id]);
      if (allCartsResults.length > 0) {
        await query(`UPDATE "Cart" SET "image" = $1 WHERE "product_id" = $2`,
        [filename, productResults[0].id]
        );
      }
    }
    // Update the inventory image
    await query(`UPDATE "inventory" SET "image" = $1 WHERE "id" = $2`, [filename, uploadId]);

    req.flash("success_msg", `Image uploaded successfully!`);
    return res.redirect(`/super/inventory/${uploadId}`); // Replace with the correct path
  } catch (err) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.log(err);
    req.flash("error_msg", `An error occurred from the database, try again!`);
    return res.redirect('/');
  }
};



exports.superSale = async (req, res) => {
  const userId = req.user.id;
  
  const metaItems = JSON.parse(req.body.meta);
  const cartItems = JSON.parse(req.body.cart);
  
  // Checking for empty cart
  if (cartItems.length <= 0) {
    req.flash("error_msg", "Cart cannot be empty");
    return res.redirect("/super/create-sales");
  }

  const uuidForEachSale = Date.now() + Math.floor(Math.random() * 1000);

  const insertData = {
    sale_id: uuidForEachSale,
    sale_type: "counter",
    store_id: null,
    store_name: null, // to be updated later to any given store
    created_date: new Date().toISOString(), // Use current date-time
    attendant_id: userId,
    payment_type: metaItems.paymentType,
    total_amount: metaItems.sumTotal,
    shipping_fee: 0
  };

  try {
    const newuuid = uuidv4()
    // Insert sale data
    await query(`INSERT INTO "Sales" (id, "sale_id", "sale_type", "store_id", "store_name", "created_date", "attendant_id", "Payment_type", "total_amount", "shipping_fee") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ newuuid,insertData.sale_id, insertData.sale_type, insertData.store_id, insertData.store_name, insertData.created_date, insertData.attendant_id, insertData.payment_type, insertData.total_amount, insertData.shipping_fee]
    );
    
    // Define an array to store promises
    const promises = cartItems.map(async (cartItem) => {
      const { id, name, price, uuid, quantity, image } = cartItem;
      const newPricePerItem = price * quantity;
      const productItem = {
        sale_id: uuidForEachSale,
        product_id: id,
        price_per_item: price,
        sub_total: newPricePerItem,
        store_id: null,
        cart_id: uuid,
        name: name,
        quantity: quantity,
        image: image
      };

      // Insert product data
      const orderedNewuuid = uuidv4()
      await query(`INSERT INTO "Order_Products" (id, "sale_id", "product_id", "price_per_item", "subTotal", "store_id", "cart_id", "name", "quantity", "image") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10)`,
        [orderedNewuuid, productItem.sale_id, productItem.product_id, productItem.price_per_item, productItem.sub_total, productItem.store_id, productItem.cart_id, productItem.name, productItem.quantity, productItem.image]
      );

      // Update stock quantity
      const productResults = await query(`SELECT "total_on_shelf" FROM "Products" WHERE "id" = $1`, [id]);
      if (productResults.rows.length === 0) {
        throw new Error(`Product with id ${id} not found`);
      }
      const currentShelfQuantity = productResults.rows[0].total_on_shelf;
      if (currentShelfQuantity < quantity) {
        throw new Error(`Not enough stock for product id ${id}`);
      }
      const newShelfQuantity = currentShelfQuantity - quantity;
      await query(`UPDATE "Products" SET "total_on_shelf" = $1 WHERE "id" = $2`, [newShelfQuantity, id]);
    });

    // Wait for all promises to resolve
    await Promise.all(promises);

    req.flash(
      "success_msg",
      `Cart has been submitted, Your order reference number is: ${uuidForEachSale}`
    );
    return res.redirect(`/super/invoice/${uuidForEachSale}`);
  } catch (error) {
    req.flash("error_msg", `Error occurred: ${error.message}`);
    return res.redirect("/super/create-sales");
  }
};


exports.superStore = async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;


  try {
    let queryStr = `SELECT * FROM "Products" WHERE "activate" = $1 AND "total_on_shelf" > $2 AND "status" = $3`;
    let queryParams = [true, 0, 'not-expired'];

    // Add category condition if it's not 'all'
    if (id !== 'all') {
      queryStr += ` AND "category" = $4`;
      queryParams.push(id.trim()); // Push the entire id string including spaces but trim the end
    }

    // Add search condition if present
    if (search) {
      queryStr += ` AND "ProductName" ILIKE $5`;
      queryParams.push(`%${search}%`);
    }

    // Order by ProductName
    queryStr += ` ORDER BY "ProductName" ASC`;

    // Execute the query
    const results = await query(queryStr, queryParams);

    console.log("Query Results:", results.rows.length);

    if (results.rows.length === 0) {
      return res.json([]);
    }

    return res.json(results.rows);
  } catch (err) {
    console.error("Error executing query:", err.message);
    req.flash("error_msg", `An error occurred: ${err.message}`);
    return res.redirect('/user');
  }
};






exports.allExclusiveCodes = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {
    // Fetch all brands from the Brands table
    const {rows:exclusiveCode} = await query(`SELECT * FROM "exclusive_codes"`);


    // Render the brandTable view
    res.render("./super/exclusiveCodeAll", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
      exclusiveCode
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};



exports.generateExclusiveCodesPage = async (req, res) => {
  const nameA = req.user.First_name;
  const nameB = req.user.Last_name;

  try {


    // Render the brandTable view
    res.render("./super/exclusiveCodeGenerate", {
      pageTitle: "Welcome",
      name: `${nameA} ${nameB}`,
      month: monthName,
      day: dayName,
      date: presentDay,
      year: presentYear,
    });
  } catch (error) {
    req.flash("error_msg", `${error.message}`); // Use error.message instead of error.sqlMessage
    return res.redirect("/super");
  }
};


exports.generateExclusiveCodes = async (req, res) => {
  const { quantity } = req.body;

  if (!quantity) {
    req.flash('error_msg', "enter quantity to generate")
    return res.redirect('back')
  }

  try {
    // Fetch all existing codes
    const existingCodes = new Set(
      (await query(`SELECT code FROM exclusive_codes`)).rows.map(row => row.code)
      );
   
    const codes = [];


    for (let i = 0; i < quantity; i++) {
      let newCode;

      // Ensure uniqueness
      do {
        newCode = generateExclusiveCodeFunction(8);
      } while (existingCodes.has(newCode));

      existingCodes.add(newCode); // Add to Set to avoid future duplicates
      codes.push({ code: newCode, is_company_generated: true, is_paid: false });
    }

    // Insert into database

    const insertCodesQuery = `INSERT INTO exclusive_codes (id, code, is_company_generated, is_paid, is_exported) VALUES ($1, $2, $3, $4, $5)`;

await Promise.all(
  codes.map(code =>
    query(insertCodesQuery, [uuidv4(), code.code, code.is_company_generated, code.is_paid, false])
  )
);

    req.flash('success_msg', `${quantity} unique codes generated successfully.`)
    return res.redirect('/super/all-exclusive-codes')

  } catch (err) {
    console.error(err);
    req.flash('error_msg', "Error generating codes.")
    return res.redirect('/super')
  }

};

exports.exportCodes = async (req, res) => {
  try {
    // Fetch unexported codes
    const result = await query(
      `SELECT code FROM exclusive_codes WHERE is_company_generated = TRUE AND is_exported = FALSE`
    );

    if (result.rows.length === 0) {
      req.flash('error_msg', "No unexported codes available. Create new batch");
      return res.redirect('/super/generate-new-codes');
    }

    const codes = result.rows;

    // Mark codes as exported
    await query(
      `UPDATE exclusive_codes SET is_exported = TRUE WHERE code = ANY($1)`,
      [codes.map(code => code.code)]
    );

    // Export to CSV
    const { Parser } = require('json2csv');
    const parser = new Parser({ fields: ['code'] });
    const csv = parser.parse(codes);

    // Set headers for file download
    res.header('Content-Type', 'text/csv');
    res.attachment('generated_codes.csv');

    // Send CSV file directly
    return res.send(csv);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', "Error exporting codes.");
    return res.redirect('/super');
  }
};
