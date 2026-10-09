/**
 * config.js - Configurazione centralizzata dell'applicazione Node.js
 */

require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
    NODE_ENV: process.env.NODE_ENV || "development"
};