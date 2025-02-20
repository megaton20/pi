const express = require("express");
const router = express.Router();
const {v4:uuidv4} = require('uuid')

const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);

const superController = require('../controllers/superController')
const upload = require('../config/multerConfig'); // Import the Multer config
const { isSuper } = require("../config/isSuper");
const { ensureAuthenticated } = require("../config/auth");

// udating image of inventory
router.post('/add-image/:id',ensureAuthenticated,isSuper,upload.single('image'),superController.updateImage)
// Welcome Page
router.get("/", ensureAuthenticated,isSuper, superController.getAdminWelcomePage);

// all table Page
router.get("/all-customers", ensureAuthenticated,isSuper, superController.getAllCustomers);
router.get("/all-brands", ensureAuthenticated,isSuper, superController.getAllBrand);
router.get("/sales", ensureAuthenticated,isSuper, superController.getAllUnresolvedSales);
router.get("/all-sales", ensureAuthenticated,isSuper, superController.getAllSales);
router.get("/all-damaged", ensureAuthenticated,isSuper, superController.getAllDamaged);
router.get("/all-employees", ensureAuthenticated,isSuper, superController.getAllEmployees);
router.get("/all-supplier", ensureAuthenticated,isSuper, superController.getAllSuppliers);
router.get("/all-stores", ensureAuthenticated,isSuper, superController.getAllStores);
router.get("/all-categories", ensureAuthenticated,isSuper, superController.getAllCategory);
router.get("/all-discounts", ensureAuthenticated,isSuper, superController.getAllDiscounts);
router.get("/all-products", ensureAuthenticated,isSuper, superController.getAllShelfItems);
router.get("/all-transactions", ensureAuthenticated,isSuper, superController.getAllTransactions);
router.get("/all-inventory", ensureAuthenticated,isSuper, superController.getAllInventory);
router.get("/all-positions", ensureAuthenticated,isSuper, superController.getAllPositions);
router.get("/new-orders", ensureAuthenticated,isSuper, superController.getAllOrders);
router.get("/all-canceled-order", ensureAuthenticated,isSuper, superController.getAllCanceledOrders);
router.get("/view-canceled/:id", ensureAuthenticated,isSuper, superController.getOneCanceledOrder);
router.get("/all-ranks", ensureAuthenticated,isSuper, superController.getAllRanks);


// region and price delivery
router.get("/all-regions/", ensureAuthenticated,isSuper, superController.gettAllPriceRegions);
router.get("/create-region", ensureAuthenticated,isSuper, superController.getAddRegions);
router.post("/create-region", ensureAuthenticated,isSuper, superController.createNewRegion);
router.get("/edit-region/:id", ensureAuthenticated,isSuper, superController.getOneRegions);
router.put("/edit-region/:id", ensureAuthenticated,isSuper, superController.updateRegion);

router.get("/all-logistic-company", ensureAuthenticated,isSuper, superController.getAllLogisticCompany);
router.get("/edit-logistic-company/:id", ensureAuthenticated,isSuper, superController.getOneLogisticCompany);
router.get("/all-logistics-drivers/", ensureAuthenticated,isSuper, superController.allLogisticDrivers);
router.get("/asign-driver-to-company/:id", ensureAuthenticated,isSuper, superController.asigneToCompany);
router.put("/add-driver-to-company/:id", ensureAuthenticated,isSuper, superController.addDriverToCompany); //


router.get("/all-external-riders", ensureAuthenticated,isSuper, superController.getExternalRiders);
router.get("/view-rider/:id", ensureAuthenticated,isSuper, superController.getOneExternalRider);

// todo
router.put("/approve-rider/:id", ensureAuthenticated,isSuper, superController.approveRiderApplication);
router.put("/disable-rider/:id", ensureAuthenticated,isSuper, superController.disapproveRiderApplication);
router.delete("/ban-rider/:id", ensureAuthenticated,isSuper, superController.banRiderForever);
// modify drivers to follow verified = true

router.get("/upgrade-users", ensureAuthenticated,isSuper, superController.getAllUsersToUpgrade);
router.get("/upgrade-users/:id", ensureAuthenticated,isSuper, superController.usersToUpgrade);
router.put("/upgrade-users/:id", ensureAuthenticated,isSuper, superController.postUsersToUpgrade);
// get single
router.get("/inventory/:id", ensureAuthenticated,isSuper, superController.getInventoryById);

// shelf manipulation
// add price for new store item to add to market
router.get("/add-price/:id", ensureAuthenticated,isSuper, superController.getAddpricePage);
router.get("/update-price/:id", ensureAuthenticated,isSuper, superController.getAddpriceUpdatePage);
router.post("/create-sales/:id", ensureAuthenticated,isSuper, superController.addToShelfForSale);
router.put("/update-price/:id", ensureAuthenticated,isSuper, superController.updatePrice);

// restock

// router.get("/restock/:id", ensureAuthenticated,isSuper, superController.getAddpriceUpdatePage);
// router.put("/restock/:id", ensureAuthenticated,isSuper, superController.updatePrice);

// reimage
// router.get("/image-name/:id/field", ensureAuthenticated,isSuper, superController.getAddpriceUpdatePage);
// router.put("/image-name/:id", ensureAuthenticated,isSuper, superController.updatePrice);

// respec
// router.get("/image-name/:id/field", ensureAuthenticated,isSuper, superController.getAddpriceUpdatePage);
// router.put("/image-name/:id", ensureAuthenticated,isSuper, superController.updatePrice);

// redetail
// router.get("/image-name/:id/field", ensureAuthenticated,isSuper, superController.getAddpriceUpdatePage);
// router.put("/image-name/:id", ensureAuthenticated,isSuper, superController.updatePrice);


// add to store
router.put('/product-status/unverified/:id',ensureAuthenticated,isSuper,superController.remove)
router.put("/resolve/:id", ensureAuthenticated,isSuper, superController.resolveSale);
router.put("/flag-product/:id", ensureAuthenticated,isSuper, superController.flagProduct);
router.put("/unflag-product/:id", ensureAuthenticated,isSuper, superController.unflagProduct);
// showcase
router.put("/showcase-on/:id", ensureAuthenticated,isSuper, superController.addToShowcase);
router.put("/showcase-off/:id", ensureAuthenticated,isSuper, superController.removeFromShowcase);

// exclusive
router.put("/exclusive-on/:id", ensureAuthenticated,isSuper, superController.addToExclusivee);
router.put("/exclusive-off/:id", ensureAuthenticated,isSuper, superController.removeFromExclusive);



// counter for super
router.get("/create-sales", ensureAuthenticated,isSuper, superController.adminCounter);
router.post("/submitCart", ensureAuthenticated,isSuper, superController.superSale);
router.get("/invoice/:id", ensureAuthenticated,isSuper, superController.invoice);



router.get("/view-order/:id", ensureAuthenticated,isSuper, superController.getSingleOrder);
router.get("/confirm-order/:id", ensureAuthenticated,isSuper, superController.confirmOrder); //
router.post("/ship-order/:id", ensureAuthenticated,isSuper, superController.shipWithCompanyDriver); //
router.post("/new-driver/:id", ensureAuthenticated,isSuper, superController.shipWithNewCompanyDriver); //
router.post("/ship-order-with-rider/:id", ensureAuthenticated,isSuper, superController.shipWithRider); //
router.post("/new-rider/:id", ensureAuthenticated,isSuper, superController.shipWithNewRider); //

// form area

router.get("/create-store", ensureAuthenticated,isSuper, superController.createStorePage);
router.get("/create-discount", ensureAuthenticated,isSuper, superController.createDiscountPage);
router.get("/create-category", ensureAuthenticated,isSuper, superController.createCategoryPage);
router.get("/create-supplier", ensureAuthenticated,isSuper, superController.createSupplierPage);
router.get("/create-position", ensureAuthenticated,isSuper, superController.createPositionPage);
router.get("/create-logistics", ensureAuthenticated,isSuper, superController.createLogisticCompanyPage);
router.get("/create-inventory", ensureAuthenticated,isSuper, superController.createInventoryPage);
router.get("/create-brand", ensureAuthenticated,isSuper, superController.createBrandPage);
router.get("/edit-brand/:id", ensureAuthenticated,isSuper, superController.editBrandPage);

router.get("/create-rank", ensureAuthenticated,isSuper, superController.createRankPage);



// post request
router.post("/create-store", ensureAuthenticated,isSuper, superController.createNewStore);
router.post("/create-discount", ensureAuthenticated,isSuper, superController.createNewDiscount);
router.post("/create-inventory", ensureAuthenticated,isSuper,upload.single('image'), superController.createNewInventory);
router.post("/create-category", ensureAuthenticated,isSuper, superController.createNewCategory);
router.post("/create-supplier", ensureAuthenticated,isSuper, superController.createNewSupplier);
router.post("/create-customer", ensureAuthenticated,isSuper, superController.createNewCustomer);
router.post("/create-position", ensureAuthenticated,isSuper, superController.createNewPosition);
router.post("/create-logistics", ensureAuthenticated,isSuper, superController.createNewLogistics);
router.post("/create-brand", ensureAuthenticated,isSuper, superController.createNewBrand);
router.post("/create-rank", ensureAuthenticated,isSuper, superController.createNewRank);





router.get("/edit-stores/:id", ensureAuthenticated,isSuper, superController.storeEdit);
router.get("/edit-discount/:id", ensureAuthenticated,isSuper,superController.editDiscount);
router.get("/edit-supplier/:id", ensureAuthenticated,isSuper, superController.editSupplier)
router.get("/edit-category/:id", ensureAuthenticated,isSuper, superController.editCategory)
router.get("/edit-Inventory/:id", ensureAuthenticated,isSuper, superController.editInventory)
router.get("/edit-position/:id", ensureAuthenticated,isSuper, superController.editPosition);
router.get("/edit-employee/:id", ensureAuthenticated,isSuper, superController.editEmployee);


router.get("/edit-rank/:id", ensureAuthenticated,isSuper, superController.rankEdit);





router.put("/edit-logistics-company/:id", ensureAuthenticated,isSuper, superController.editLogisticsComp);

router.put("/edit-employee/:id", ensureAuthenticated,isSuper, superController.updateEmployee);
router.put("/edit-store/:id", ensureAuthenticated,isSuper, superController.editNewStore);
router.put("/edit-discount/:id", ensureAuthenticated,isSuper, superController.editNewDiscount);
router.put("/edit-supplier/:id", ensureAuthenticated,isSuper, superController.editNewSupplier);
router.put("/edit-category/:id", ensureAuthenticated,isSuper, superController.editNewCategory);
router.put("/edit-inventory/:id", ensureAuthenticated,isSuper, superController.editNewInventory);
router.put("/edit-position/:id", ensureAuthenticated,isSuper, superController.editNewPosition);
router.put("/update-brand/:id", ensureAuthenticated,isSuper, superController.updateBrand);
router.put("/edit-rank/:id", ensureAuthenticated,isSuper, superController.updateRank);




// delete

router.delete("/delete-store/:id", ensureAuthenticated,isSuper, superController.deleteStore);
router.delete("/delete-employee/:id", ensureAuthenticated,isSuper, superController.deleteEmployee);
router.delete("/delete-discount/:id", ensureAuthenticated,isSuper, superController.deleteDiscount);
router.delete("/delete-supplier/:id", ensureAuthenticated,isSuper, superController.deleteSupplier);
router.delete("/delete-category/:id", ensureAuthenticated,isSuper, superController.deleteCategory);
router.delete("/delete-inventory/:id", ensureAuthenticated,isSuper, superController.deleteInventory);
router.delete("/delete-position/:id", ensureAuthenticated,isSuper, superController.deletePosition);
router.delete("/delete-brand/:id", ensureAuthenticated,isSuper, superController.deleteBrand);
router.delete("/delete-rank/:id", ensureAuthenticated,isSuper, superController.deleteRank);




// search and  category filter
router.get("/getItems/:id", ensureAuthenticated,isSuper,superController.superStore);



// Toggle the tag association between a product and a tag
router.post('/products/:productId/tags/:tagId/toggle', ensureAuthenticated, isSuper, async (req, res) => {
    const { productId, tagId } = req.params;

    try {
        // Check if product exists
        const {rows: productExists} = await query('SELECT 1 FROM "inventory" WHERE id = $1', [productId]);


        if (productExists.length === 0) {
            return res.status(404).send('inventory not found');
        }

        // Check if tag exists
        const tagExists = await query('SELECT 1 FROM Tags WHERE id = $1', [tagId]);

        if (tagExists.rows.length === 0) {
            return res.status(404).send('Tag not found');
        }

        // Check if the relationship already exists
        const {rows:existing} = await query('SELECT * FROM inventory_tags WHERE "inventory_id" = $1 AND "tag_id" = $2', [productId, tagId]);

        if (existing.length > 0) {
            // If the association exists, delete it (toggle off)
            await query('DELETE FROM inventory_tags WHERE inventory_id = $1 AND tag_id = $2', [productId, tagId]);
            req.flash("success_msg", `Tag removed from inventory`);
        } else {
            // If the association doesn't exist, add it (toggle on)
            const newuuid = uuidv4()
            await query('INSERT INTO inventory_tags (id, inventory_id, tag_id) VALUES ($1, $2, $3)', [newuuid, productId, tagId]);
            req.flash("success_msg", `Tag added to inventory`);
        }

      
    } catch (error) {
        console.error(error);
        res.status(500).send('Error toggling tag association');
    }
});


router.get('/tags', ensureAuthenticated,isSuper, async (req, res) => {
    const nameA = req.user.First_name;
    const nameB = req.user.Last_name;
  

    try {
        const {rows:tags} = await query('SELECT * FROM tags');

        res.render("./super/tagsTable", {
            pageTitle: "All tags",
            name: `${nameA} ${nameB}`,
            month: "monthName",
            day: "dayName",
            date: "presentDay",
            year: "presentYear",
            tags
          });
    } catch (error) {
        console.error(error);
        res.redirect('/')
    }
});

router.get('/create-tags', ensureAuthenticated,isSuper, async (req, res) => {
    const nameA = req.user.First_name;
    const nameB = req.user.Last_name;
  

    try {

        res.render("./super/tagsCreateForm",{
            pageTitle:"create tag",
            name: `${nameA} ${nameB}`,
            month:"monthName",
            day: "dayName",
            date: "presentDay",
            year: "presentYear",
          }
        );
    } catch (error) {
        console.error(error);
        res.redirect('/')
    }
});

router.post('/tags', ensureAuthenticated,isSuper, async (req, res) => {
    const { tagName } = req.body;

    try {

        const newuuid = uuidv4()

        const result = await query('INSERT INTO Tags (id, tag_name) VALUES ($1, $2) RETURNING *',[newuuid, tagName]);
        req.flash('success_msg','tag added')
        res.redirect('/super/tags')
    } catch (error) {
        console.error(error);
        req.flash('error_msg',`error adding tag ${error}`)
        res.redirect('/super')
    }
});

router.get('/update-tags/:id', ensureAuthenticated,isSuper, async (req, res) => {
    const nameA = req.user.First_name;
    const nameB = req.user.Last_name;
  

    try {
        const results = await query(`SELECT * FROM tags WHERE "id" = $1`,[req.params.id]);

        if (results.rows.length <= 0) {
          req.flash("warning_msg", `No tag found with ID ${req.params.id}`);
          return res.redirect("/super");
        }
    
        const tagData = results.rows;
        // If you need to fetch stateData, do so here and include it in the render options
    

        res.render("./super/tagsEditForm",{
            pageTitle:"edit tag",
            name: `${nameA} ${nameB}`,
            month:"monthName",
            day: "dayName",
            date: "presentDay",
            year: "presentYear",
            tagData
          }
        );
    } catch (error) {
        console.error(error);
        res.redirect('/')
    }
});


router.put('/tags/:tagId', ensureAuthenticated,isSuper, async (req, res) => {
    const { tagId } = req.params;
    const { tagName } = req.body;


    try {
        const result = await query('UPDATE Tags SET tag_name = $1 WHERE id = $2 RETURNING *',[tagName, tagId]);
        if (result.rows.length === 0) {
            req.flash('error_msg','tag not found')
            return res.redirect('/super')
        }
        req.flash('success_msg','tag name changed ')
        return res.redirect('/super/tags')
    } catch (error) {
        console.error(error);
        req.flash('error_msg','Error updating tag')
        res.redirect('/super')
    }
});

router.delete('/tags/:tagId', ensureAuthenticated,isSuper, async (req, res) => {
    const { tagId } = req.params;

    try {
        await query('DELETE FROM Tags WHERE id = $1', [tagId]);
        req.flash('success_msg','tag deleted ')
        return res.redirect('/super/tags')
    } catch (error) {
        console.error(error);
        req.flash('error_msg','Error deleting tag')
        return res.redirect('/super/tags')
    }
});



router.get('/tags/:tagId/products', ensureAuthenticated,isSuper, async (req, res) => {
    const { tagId } = req.params;
    const userFirstName = req.user.First_name;
    const userLastName = req.user.Last_name;
    let msg = []

    try {
        const {rows:allInventory} = await query('SELECT "inventory".* FROM "inventory" ' + 'JOIN inventory_Tags ON "inventory".id = inventory_Tags.inventory_id ' +'WHERE inventory_Tags.tag_id = $1',[tagId]);
        const {rows:results} = await query(`SELECT * FROM tags WHERE "id" = $1`,[tagId]);
        

        msg.push( { type: 'warning', text:`${allInventory.length} inventory item in this tag` })
        msg.push( { type: 'success', text:`${results[0].tag_name}` })
    return res.render("./super/inventoryTable", {
        pageTitle: "All Inventory",
        name: `${userFirstName} ${userLastName}`,
        month: "monthName",
        day: "dayName",
        date: "presentDay",
        year: "presentYear",
        allInventory,
        msg
      });
    } catch (error) {
        console.error(error);
        req.flash('error_msg','Error getting inventory')
        return res.redirect('/super/tags')
    }
});




router.post('/products/:productId/combo/toggle', ensureAuthenticated, isSuper, async (req, res) => {
    const { productId } = req.params;

    try {

    // Check the current combo state for the product
        const { rows: existing } = await query('SELECT "is_combo" FROM inventory WHERE "id" = $1', [productId]);

        if (existing.length > 0) {
            const currentState = existing[0].is_combo;

            if (currentState) {
                // If the current state is true, set it to false (toggle off)
                await query('UPDATE inventory SET "is_combo" = false WHERE "id" = $1', [productId]);
                res.status(200).send('inventory set');
            } else {
                // If the current state is false, set it to true (toggle on)

                await query('UPDATE inventory SET "is_combo" = true WHERE "id" = $1', [productId]);
                return res.status(200).send('inventory unset');


            }
        } else {
            return res.status(404).send('inventory not found');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Error toggling tag association');
    }
});



router.get("/all-exclusive-codes", ensureAuthenticated,isSuper, superController.allExclusiveCodes);
router.get("/generate-new-codes", ensureAuthenticated,isSuper, superController.generateExclusiveCodesPage);
router.post("/generate-codes", ensureAuthenticated,isSuper, superController.generateExclusiveCodes);
router.get("/export-codes", ensureAuthenticated,isSuper, superController.exportCodes);


module.exports = router;
