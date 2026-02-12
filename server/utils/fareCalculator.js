/**
 * @desc Calculates fare based on Ashland Public Transit official pricing
 * @param {string} userType - 'General', 'Elderly/Disabled', or 'Child'
 * @param {boolean} isSameDay - If booking is less than 24h in advance
 * @param {number} passengers - Total number of riders
 * @param {boolean} isOutOfTown - If travel is outside city limits
 * @param {number} miles - Miles traveled outside city limits
 */
const calculateFare = (userType, isSameDay, passengers, isOutOfTown = false, miles = 0) => {


    // 1. Determine Base Fare
    // Rates: Standard ($2.00), Senior/Disabled ($1.00), Student ($1.50), Veteran (Free)
    const RATES = {
        'Standard': 2.00,
        'General': 2.00, // Fallback
        'Senior': 1.00,
        'Elderly/Disabled': 1.00,
        'Student': 1.50,
        'Child': 1.00,
        'Veteran': 0.00
    };

    let baseFare = RATES[userType] !== undefined ? RATES[userType] : 2.00;

    // Surcharge for "Same Day" bookings (skip for Veterans/Seniors if desired, but keeping logic simple for now)
    // Business Rule: Same Day adds $1.00 surcharge for Standard/Student
    if (isSameDay) {
        if (userType === 'Standard' || userType === 'General' || userType === 'Student') {
            baseFare += 1.00; // Same Day Surcharge
        }
    }

    // 2. Multi-passenger logic (Second person pays half-price if not free)
    let total = baseFare;
    if (passengers > 1 && baseFare > 0) {
        const discountedRiders = passengers - 1;
        total += (baseFare / 2) * discountedRiders;
    }

    // 3. Out of Town logic ($2.50 per mile outside city) - Stays the same
    if (isOutOfTown && miles > 0) {
        total += (miles * 2.50);
    }

    return total;
};

module.exports = calculateFare;