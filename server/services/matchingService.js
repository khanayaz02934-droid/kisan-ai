import Product from '../models/productModel.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Fuzzy match medicine keywords against products
 * @param {string[]} keywords - Keywords from AI crop scan analysis
 * @returns {Product[]} Matched products (up to 6)
 */
const matchProductsByKeywords = async (keywords = []) => {
  if (!keywords || keywords.length === 0) return [];

  try {
    // Build a regex pattern from keywords (case-insensitive, escaped)
    const patterns = keywords.map((kw) => new RegExp(escapeRegExp(kw), 'i'));

    // Query: match any keyword in name.en, tags, or category
    const matchedProducts = await Product.find({
      isActive: true,
      stock: { $gt: 0 },
      $or: patterns.flatMap((pattern) => [
        { 'name.en': pattern },
        { tags: pattern },
        { category: pattern },
      ]),
    })
      .select('name description price unit stock image category tags')
      .limit(6)
      .lean();

    // Add addToCartUrl to each product
    return matchedProducts.map((p) => ({
      ...p,
      addToCartUrl: `/cart/add/${p._id}`,
    }));
  } catch (error) {
    console.error('Matching service error:', error.message);
    return [];
  }
};

export { matchProductsByKeywords };
