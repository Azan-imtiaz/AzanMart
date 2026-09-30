// Demo catalog for the seed script. Prices are in dollars here and converted to cents on insert.
module.exports.products = [
  {
    name: "Heritage Leather Backpack",
    image: "heritage-leather-backpack.png",
    category: "Backpacks",
    price: 189,
    discount: 10,
    stock: 6,
    bgcolor: "#fde8d8",
    description:
      "Full-grain leather that softens and darkens with every year of use. Brass zips, a cotton-lined interior and padded shoulder straps.",
  },
  {
    name: "Navy Commuter Backpack",
    image: "navy-commuter-backpack.png",
    category: "Backpacks",
    price: 69,
    discount: 0,
    stock: 24,
    bgcolor: "#dbeafe",
    description:
      "A slim, water-resistant backpack for the daily commute. A padded sleeve fits laptops up to 15 inches, and the quick-access front pocket keeps your keys and cards within reach.",
  },
  {
    name: "Black Everyday Daypack",
    image: "black-everyday-daypack.png",
    category: "Backpacks",
    price: 45,
    discount: 15,
    stock: 40,
    bgcolor: "#e5e7eb",
    description:
      "Lightweight and simple, with one big compartment and a zip front pocket. Good for class, the gym or a day out.",
  },
  {
    name: "Anti-Theft Laptop Backpack",
    image: "anti-theft-laptop-backpack.png",
    category: "Travel",
    price: 99,
    discount: 20,
    stock: 15,
    bgcolor: "#f3f4f6",
    description:
      "Hidden zips sit against your back, the hard shell resists slashes, and a side USB port lets you charge your phone from a power bank inside.",
  },
  {
    name: "Tan Leather Weekender",
    image: "tan-leather-weekender.png",
    category: "Travel",
    price: 159,
    discount: 0,
    stock: 4,
    bgcolor: "#fef3c7",
    description:
      "Sized for two or three nights away and small enough for most overhead bins. Comes with a detachable, adjustable shoulder strap.",
  },
  {
    name: "Natural Canvas Tote",
    image: "natural-canvas-tote.png",
    category: "Totes",
    price: 24,
    discount: 0,
    stock: 60,
    bgcolor: "#f5f5f4",
    description:
      "Heavy cotton canvas with long handles that sit comfortably on the shoulder. Folds flat when you don't need it.",
  },
  {
    name: "Jute Market Tote",
    image: "jute-market-tote.png",
    category: "Totes",
    price: 29,
    discount: 25,
    stock: 0,
    bgcolor: "#ecfccb",
    description:
      "A sturdy, reusable shopper woven from natural jute, with reinforced cotton handles for heavy grocery runs.",
  },
  {
    name: "Burlap Drawstring Pouch",
    image: "burlap-drawstring-pouch.png",
    category: "Accessories",
    price: 12,
    discount: 0,
    stock: 80,
    bgcolor: "#fef9c3",
    description:
      "A small drawstring pouch for cables, chargers or gifts. Keeps bits and pieces together inside a bigger bag.",
  },
];

module.exports.customers = [
  "Ayesha Khan",
  "Bilal Ahmed",
  "Hira Malik",
  "Usman Tariq",
  "Zainab Hussain",
  "Omar Farooq",
];

module.exports.reviews = [
  {
    rating: 5,
    comment:
      "Exactly as pictured and really well made. Fits my laptop and lunch with room to spare.",
  },
  { rating: 4, comment: "Good quality for the price. The straps could use a little more padding." },
  { rating: 5, comment: "Arrived quickly and looks even better in person." },
  {
    rating: 3,
    comment: "Nice bag, but smaller than I expected. Check the dimensions before ordering.",
  },
  { rating: 5, comment: "Bought one for my brother as well. We both love them." },
  { rating: 4, comment: "Solid stitching and the zips feel sturdy. Would buy again." },
];

module.exports.cities = [
  ["Lahore", "54000"],
  ["Karachi", "74200"],
  ["Islamabad", "44000"],
  ["Rawalpindi", "46000"],
  ["Faisalabad", "38000"],
];
