const express = require('express');
const router = express.Router();
const chatbotCtrl = require('../controllers/chatbot.controller');

router.post("/", chatbotCtrl.consultarIA);

module.exports = router;