import express from "express";
import { verifyToken } from '../middleware/verifyToken.js'
import { getOverview } from "../controller/overviewController.js";

const overviewRoutes = express.Router()

overviewRoutes.get('/overviews', verifyToken, getOverview)

export default overviewRoutes