/**
 * @desc Calculates fare based on Ashland Public Transit official pricing
 * @param {string} userType - 'Standard', 'Senior', 'Student', 'Veteran', etc.
 * @param {boolean} isSameDay - If booking is less than 24h in advance
 * @param {number} passengers - Total number of riders
 * @param {boolean} isOutOfTown - If travel is outside city limits
 * @param {number} miles - Miles traveled outside city limits
 */
export const calculateFare = (userType, isSameDay, passengers, isOutOfTown = false, miles = 0) => {


    // 1. Determine Base Fare based on User Type and Timing
    // Rates: Standard ($3.00/$5.00), Senior/Disabled ($1.50/$2.50), Student ($1.50/$2.50)
    let baseFare = 0;

    if (userType === 'Standard' || userType === 'General' || userType === 'Student') {
        baseFare = isSameDay ? 5.00 : 3.00;
    } else if (['Senior', 'Elderly/Disabled', 'Child'].includes(userType)) {
        baseFare = isSameDay ? 2.50 : 1.50;
    } else if (userType === 'Veteran') {
        baseFare = 0.00; // Free
    } else {
        baseFare = isSameDay ? 5.00 : 3.00; // Default to Standard
    }

    // 2. Multi-passenger logic
    // Rule: "If a second person riding is going to the same destination as the general public rider, the second person pays half-price"
    // This implies the discount is primarily for General Public/Standard fares.
    // For Elderly/Disabled, the rate is "Per Trip", suggesting flat rate (though we can be generous if needed, strictly text says Per Trip).
    // However, for implementation safety and to fix the specific user complaint ($6 for 5 people was too low, implies old logic was finding $2 base),
    // we will apply half-price rule to Standard/Student.

    let total = baseFare;

    if (passengers > 1 && baseFare > 0) {
        const additionalPassengers = passengers - 1;

        if (['Standard', 'General', 'Student'].includes(userType)) {
            // Half Price for additional passengers
            total += (baseFare / 2) * additionalPassengers;
        } else {
            // Full Price for additional passengers (Elderly/Disabled/Child)
            // Text says "$1.50 per trip", doesn't explicitly mention group discount for them.
            total += baseFare * additionalPassengers;
        }
    }

    // 3. Out of Town logic
    if (isOutOfTown && miles > 0) {
        // Base In-Town Rate + $2.50/mile
        total += (miles * 2.50);
    }

    return total;
};
