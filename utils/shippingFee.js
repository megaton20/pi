const { log } = require("console");
const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);

async function calculateShippingFee(location) {
    try {
        // Query the database for the shipping fee based on the provided location (LGA)
        const { rows } = await query(
            `SELECT fee FROM "shipping_regions" WHERE LOWER("lga") = $1`, 
            [location.toLowerCase()]
        );

        // If no matching location is found, return a default fee (0 or any other value)
        if (rows.length === 0) {
            return 0; // No fee found for the location
        }

        // Retrieve the shipping fee from the query result
        let shippingFee = rows[0].fee;

        // Cap the shipping fee to a maximum of NGN 15,000 if necessary
        if (shippingFee > 15000) {
            shippingFee = 15000;
        }

        return shippingFee;
    } catch (error) {
        console.error("Error calculating shipping fee:", error);
        throw error;
    }
}

module.exports = calculateShippingFee;
