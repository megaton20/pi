function addRecentlyViewedItem(req, viewdItem) {
    // Initialize recentlyViewed array if it doesn't exist

    let item = viewdItem[0]
    if (!req.session.recentlyViewed) {
        req.session.recentlyViewed = [];
    }

    // Check if the item already exists in the array
    const exists = req.session.recentlyViewed.some(viewedItem => viewedItem.id === item.id);

    // If the item doesn't exist, add it to the beginning of the array
    if (!exists) {
        req.session.recentlyViewed.unshift(item);
    }

    // Optional: Limit the number of items stored
    const maxItems = 10;
    if (req.session.recentlyViewed.length > maxItems) {
        req.session.recentlyViewed.pop();
    }
}

module.exports = addRecentlyViewedItem;