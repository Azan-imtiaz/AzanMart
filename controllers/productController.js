const productModel = require("../models/productModel");

exports.createProduct = async (req, res) => {
  if (!req.file) {
    req.flash("error", "Product image is required");
    return res.redirect("/owners/admin");
  }

  const { name, price, discount, bgcolor, panelcolor, textcolor } = req.body;
  await productModel.create({
    image: req.file.buffer,
    name,
    price,
    discount: discount || 0,
    bgcolor,
    panelcolor,
    textcolor,
  });

  req.flash("success", "Product created successfully");
  res.redirect("/owners/admin");
};
