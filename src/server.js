// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Health check (BEFORE routes - to test if server works)
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     status: 'OK', 
//     message: 'MelodyStore API is running'
//   });
// });

// // Test route
// app.get('/api/test', (req, res) => {
//   res.json({ message: 'Test route is working!' });
// });

// // Import routes (try one at a time to find the problem)
// try {
//   const authRoutes = require('./routes/auth.routes');
//   app.use('/api/auth', authRoutes);
//   console.log('✅ Auth routes loaded');
// } catch (error) {
//   console.error('❌ Failed to load auth routes:', error.message);
// }

// try {
//   const productRoutes = require('./routes/product.routes');
//   app.use('/api/products', productRoutes);
//   console.log('✅ Product routes loaded');
// } catch (error) {
//   console.error('❌ Failed to load product routes:', error.message);
// }

// try {
//   const categoryRoutes = require('./routes/category.routes');
//   app.use('/api/categories', categoryRoutes);
//   console.log('✅ Category routes loaded');
// } catch (error) {
//   console.error('❌ Failed to load category routes:', error.message);
// }

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('Error:', err.message);
//   res.status(500).json({
//     success: false,
//     message: err.message || 'Internal Server Error'
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
// });

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Enable CORS for all origins (for development)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Your routes...
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/categories', require('./routes/category.routes'));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});