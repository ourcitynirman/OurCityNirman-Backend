/**
 * GST State Codes Map (Indian GST Jurisdiction)
 * The first 2 digits of an Indian GSTIN correspond to the state code.
 */
export const GST_STATE_CODES = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
    '97': 'Other Territory'
};

export const INDIAN_STATES = Object.values(GST_STATE_CODES);

/**
 * Resolves Indian State Name from 6-digit PIN code.
 * @param {String|Number} pincode 
 * @returns {String} State Name or empty string
 */
export function getStateFromPincode(pincode) {
    if (!pincode) return '';
    const pinStr = String(pincode).trim().replace(/\D/g, '');
    if (pinStr.length !== 6) return '';
    
    const first2 = parseInt(pinStr.substring(0, 2), 10);
    const first3 = parseInt(pinStr.substring(0, 3), 10);

    if (first2 === 11) return 'Delhi';
    if (first2 === 12 || first2 === 13) return 'Haryana';
    if (first2 === 14 || first2 === 15) return 'Punjab';
    if (first2 === 16) return 'Chandigarh';
    if (first2 === 17) return 'Himachal Pradesh';
    if (first2 === 18 || first2 === 19) return 'Jammu and Kashmir';
    
    if (first2 >= 20 && first2 <= 28) {
        if (first3 >= 248 && first3 <= 263) return 'Uttarakhand';
        if (first3 === 300) return 'Uttarakhand';
        return 'Uttar Pradesh';
    }
    
    if (first2 >= 30 && first2 <= 34) return 'Rajasthan';
    
    if (first2 >= 36 && first2 <= 39) return 'Gujarat';
    
    if (first2 >= 40 && first2 <= 44) {
        if (first3 === 403) return 'Goa';
        return 'Maharashtra';
    }
    
    if (first2 >= 45 && first2 <= 49) {
        if (first2 === 49) return 'Chhattisgarh';
        return 'Madhya Pradesh';
    }
    
    if (first2 >= 50 && first2 <= 53) {
        if (first3 >= 500 && first3 <= 509) return 'Telangana';
        return 'Andhra Pradesh';
    }
    
    if (first2 >= 56 && first2 <= 59) return 'Karnataka';
    
    if (first2 >= 60 && first2 <= 64) {
        if (first3 === 605 || first3 === 609) return 'Puducherry';
        return 'Tamil Nadu';
    }
    
    if (first2 >= 67 && first2 <= 69) return 'Kerala';
    
    if (first2 >= 70 && first2 <= 74) {
        if (first3 === 737) return 'Sikkim';
        if (first3 === 744) return 'Andaman and Nicobar Islands';
        return 'West Bengal';
    }
    
    if (first2 >= 75 && first2 <= 77) return 'Odisha';
    
    if (first2 === 78) return 'Assam';
    
    if (first2 === 79) {
        if (first3 >= 790 && first3 <= 792) return 'Arunachal Pradesh';
        if (first3 === 795) return 'Manipur';
        if (first3 === 793 || first3 === 794) return 'Meghalaya';
        if (first3 === 796) return 'Mizoram';
        if (first3 === 797 || first3 === 798) return 'Nagaland';
        if (first3 === 799) return 'Tripura';
        return 'Meghalaya';
    }
    
    if (first2 >= 80 && first2 <= 85) {
        const jhPrefixes = [814, 815, 816, 825, 826, 827, 828, 829, 831, 832, 833, 834, 835];
        if (jhPrefixes.includes(first3)) return 'Jharkhand';
        return 'Bihar';
    }
    
    return '';
}

/**
 * Normalizes state name to remove spaces, special characters, and casing for safe matching.
 * @param {String} stateName 
 * @returns {String}
 */
export function normalizeStateName(stateName) {
    if (!stateName || typeof stateName !== 'string') return '';
    return stateName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Retrieves state name from address object or string.
 * @param {Object|String} address 
 * @returns {String}
 */
export function getStateFromAddress(address) {
    if (!address) return '';
    if (typeof address === 'string') {
        const lower = address.toLowerCase();
        const matched = INDIAN_STATES.find(s => lower.includes(s.toLowerCase()));
        return matched || '';
    }
    return address.state ? address.state.trim() : '';
}

/**
 * Identifies the state name from a standard 15-character GSTIN.
 * @param {String} gstin 
 * @returns {String}
 */
export function getStateFromGSTIN(gstin) {
    if (!gstin || typeof gstin !== 'string') return '';
    const cleanGstin = gstin.trim();
    if (cleanGstin.length >= 2) {
        const stateCode = cleanGstin.substring(0, 2);
        return GST_STATE_CODES[stateCode] || '';
    }
    return '';
}

/**
 * Determines whether a transaction is Inter-State or Intra-State.
 * Supports validation using pincodes.
 * @param {String} vendorState 
 * @param {String} customerShippingState 
 * @param {String|Number} vendorPincode 
 * @param {String|Number} customerPincode 
 * @returns {Boolean} True if Inter-State (IGST), False if Intra-State (CGST + SGST)
 */
export function isInterStateTransaction(vendorState, customerShippingState, vendorPincode = '', customerPincode = '') {
    const resolvedVendorState = getStateFromPincode(vendorPincode) || vendorState;
    const resolvedCustomerState = getStateFromPincode(customerPincode) || customerShippingState;
    
    if (!resolvedVendorState || !resolvedCustomerState) return true; // Keep it conservative (default to inter-state)
    return normalizeStateName(resolvedVendorState) !== normalizeStateName(resolvedCustomerState);
}

/**
 * Calculates complete GST breakdown for a single item.
 * Prices are inclusive of tax as per existing MERN cart calculation logic.
 * @param {Number} grossPriceInclusive - Item price including GST
 * @param {Number} quantity 
 * @param {Number} gstRate - Total GST rate percentage (e.g. 5, 12, 18, 28)
 * @param {Boolean} isInterState 
 */
export function calculateGSTBreakdown(grossPriceInclusive, quantity, gstRate = 18, isInterState = true) {
    const qty = Math.max(1, Number(quantity) || 1);
    const rate = Number(gstRate) || 0;
    const priceInc = Number(grossPriceInclusive) || 0;

    const grossAmount = priceInc * qty;
    const taxableValue = grossAmount / (1 + (rate / 100));
    const totalTax = grossAmount - taxableValue;

    if (isInterState) {
        return {
            taxableValue,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: rate,
            igstAmount: totalTax,
            totalTax,
            total: grossAmount
        };
    } else {
        return {
            taxableValue,
            cgstRate: rate / 2,
            cgstAmount: totalTax / 2,
            sgstRate: rate / 2,
            sgstAmount: totalTax / 2,
            igstRate: 0,
            igstAmount: 0,
            totalTax,
            total: grossAmount
        };
    }
}

/**
 * Calculates vendor-wise taxes for an item list.
 * @param {Array} items - Items with { price, quantity, gstRate }
 * @param {String} vendorState 
 * @param {String} customerShippingState 
 */
export function calculateVendorWiseTax(items, vendorState, customerShippingState) {
    const isInter = isInterStateTransaction(vendorState, customerShippingState);
    return items.map(item => {
        const gstRate = item.gstRate ?? 18;
        const breakdown = calculateGSTBreakdown(item.price, item.quantity, gstRate, isInter);
        return {
            ...item,
            ...breakdown
        };
    });
}

/**
 * Aggregates a multi-item tax breakdown summary.
 * @param {Array} enrichedItems - Items with calculated tax parameters
 */
export function generateInvoiceTaxSummary(enrichedItems) {
    const summary = {};
    let totalTaxableValue = 0;
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;
    let totalTaxAmount = 0;

    for (const item of enrichedItems) {
        const cg = Number(item.cgstAmount) || 0;
        const sg = Number(item.sgstAmount) || 0;
        const ig = Number(item.igstAmount) || 0;
        const taxVal = Number(item.taxableValue) || 0;

        const rate = (Number(item.igstRate) > 0) ? Number(item.igstRate) : (Number(item.cgstRate) + Number(item.sgstRate));
        const key = `${rate}%`;

        if (!summary[key]) {
            summary[key] = {
                rate,
                taxableValue: 0,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: 0,
                taxAmount: 0,
            };
        }

        summary[key].taxableValue += taxVal;
        summary[key].cgstAmount += cg;
        summary[key].sgstAmount += sg;
        summary[key].igstAmount += ig;
        summary[key].taxAmount += (cg + sg + ig);

        totalTaxableValue += taxVal;
        totalCgstAmount += cg;
        totalSgstAmount += sg;
        totalIgstAmount += ig;
        totalTaxAmount += (cg + sg + ig);
    }

    return {
        breakdownByRate: Object.values(summary),
        totalTaxableValue,
        totalCgstAmount,
        totalSgstAmount,
        totalIgstAmount,
        totalTaxAmount
    };
}
