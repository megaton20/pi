
// Generate 100 sample customers with random data
const customers = [
  { name: "Alice", email: "alice.smith@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Bob", email: "bojones@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Charlie", email: "charliebrown@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Diana", email: "dianajohnson@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Evan", email: "evan.jackson@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Fiona", email: "fiona.miller@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "George", email: "george.wilson@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Hannah", email: "hannahmartin@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Isaac", email: "isaac.lee@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Judy", email: "judy.wright@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Kevin", email: "kevinwalker@gmail.com", points: Math.floor(Math.random() * 100) },
  { name: "Laura", email: "laurahall@gmail.com", points: Math.floor(Math.random() * 100) },
];
  
  // Function to mask email
  function maskEmail(email) {
    const [name, domain] = email.split("@");
    const maskedName = name.slice(0, 4) + "*".repeat(name.length - 4);
    return `${maskedName}@${domain}`;
  }
  
  // Function to filter and mask recent customers
  function getRecentCustomers() {
    return customers
      .filter(customer => customer.points > 0) // Assuming "recent" means customers with points > 0
      .map(customer => ({
        ...customer,
        maskedEmail: maskEmail(customer.email)
      }));
  }
  
  // Export the recent customers function
  module.exports = getRecentCustomers;