import { Router } from 'express';
import { getPincodeDetails } from './pincode.controller.js';

const router = Router();

router.get('/:pincode', getPincodeDetails);

export default router;
