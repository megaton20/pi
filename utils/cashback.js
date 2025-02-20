

function calculateCashback(amountSpent, userRank) {
    let cashback = 0;

    // Normalize user rank to handle case sensitivity
    const rank = userRank.toLowerCase();

    // Determine cashback based on user rank and amount spent
    if (rank === 'elite') {
        if (amountSpent > 20000) {
            cashback = 150.00; // NGN 15 cashback for items above NGN 20,000
        } else if (amountSpent > 10000) {
            cashback = 100.00; // NGN 10 cashback for items between NGN 10,001 and NGN 20,000
        } else if (amountSpent > 5000) {
            cashback = 70.00;  // NGN 7 cashback for items between NGN 5,001 and NGN 10,000
        } else {
            cashback = 50.00;  // NGN 5 cashback for items below NGN 5,000
        }
    } else if (rank === 'diamond') {
        if (amountSpent > 20000) {
            cashback = 120.00; // NGN 12 cashback for items above NGN 20,000
        } else if (amountSpent > 10000) {
            cashback = 80.00;  // NGN 8 cashback for items between NGN 10,001 and NGN 20,000
        } else if (amountSpent > 5000) {
            cashback = 50.00;  // NGN 5 cashback for items between NGN 5,001 and NGN 10,000
        } else {
            cashback = 30.00;  // NGN 3 cashback for items below NGN 5,000
        }
    } else if (rank === 'gold') {
        if (amountSpent > 20000) {
            cashback = 100.00; // NGN 10 cashback for items above NGN 20,000
        } else if (amountSpent > 10000) {
            cashback = 70.00;  // NGN 7 cashback for items between NGN 10,001 and NGN 20,000
        } else if (amountSpent > 5000) {
            cashback = 40.00;  // NGN 4 cashback for items between NGN 5,001 and NGN 10,000
        } else {
            cashback = 20.00;  // NGN 2 cashback for items below NGN 5,000
        }
    } else if (rank === 'silver') {
        if (amountSpent > 20000) {
            cashback = 80.00;  // NGN 8 cashback for items above NGN 20,000
        } else if (amountSpent > 10000) {
            cashback = 50.00;  // NGN 5 cashback for items between NGN 10,001 and NGN 20,000
        } else if (amountSpent > 5000) {
            cashback = 30.00;  // NGN 3 cashback for items between NGN 5,001 and NGN 10,000
        } else {
            cashback = 15.00;  // NGN 1.5 cashback for items below NGN 5,000
        }
    } else if (rank === 'bronze') {
        if (amountSpent > 20000) {
            cashback = 60.00;  // NGN 6 cashback for items above NGN 20,000
        } else if (amountSpent > 10000) {
            cashback = 40.00;  // NGN 4 cashback for items between NGN 10,001 and NGN 20,000
        } else if (amountSpent > 5000) {
            cashback = 20.00;  // NGN 2 cashback for items between NGN 5,001 and NGN 10,000
        } else {
            cashback = 10.00;  // NGN 1 cashback for items below NGN 5,000
        }
    } else {
        // Default case for unknown ranks
        cashback = 0.00;
    }

    return cashback;
}


module.exports = calculateCashback;