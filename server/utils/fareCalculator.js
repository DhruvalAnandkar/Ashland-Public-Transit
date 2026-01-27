/**
 * @desc Calculates fare based on Ashland Public Transit official pricing
 * @param {string} userType - 'General', 'Elderly/Disabled', or 'Child'
 * @param {boolean} isSameDay - If booking is less than 24h in advance
 * @param {number} passengers - Total number of riders
 * @param {boolean} isOutOfTown - If travel is outside city limits
 * @param {number} miles - Miles traveled outside city limits
 */
const calculateFare = (userType, isSameDay, passengers, isOutOfTown = false, miles = 0) => {
    let baseFare = 0;
    
    // 1. Determine Base Fare
    if (isSameDay) {
        baseFare = (userType === 'Elderly/Disabled') ? 2.50 : 5.00;
    } else {
        baseFare = (userType === 'Elderly/Disabled') ? 1.50 : 3.00;
    }

    // 2. Multi-passenger logic (Second person pays half-price)
    let total = baseFare;
    if (passengers > 1) {
        const discountedRiders = passengers - 1;
        total += (baseFare / 2) * discountedRiders;
    }

    // 3. Out of Town logic ($2.50 per mile outside city)
    if (isOutOfTown && miles > 0) {
        total += (miles * 2.50);
    }

    // 4. Special Child Logic (Simplified: Under 12 with adult is FREE)
    // In a full system, we'd check age, but for MVP we assume the calculated total 
    // covers the fare-paying adults.
    
    return total;
};

module.exports = calculateFare;