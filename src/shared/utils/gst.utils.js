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
 * @param {String} vendorState 
 * @param {String} customerShippingState 
 * @returns {Boolean} True if Inter-State (IGST), False if Intra-State (CGST + SGST)
 */
export function isInterStateTransaction(vendorState, customerShippingState) {
    if (!vendorState || !customerShippingState) return true; // Keep it conservative (default to inter-state)
    return normalizeStateName(vendorState) !== normalizeStateName(customerShippingState);
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
