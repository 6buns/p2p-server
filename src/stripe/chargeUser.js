
exports.chargeUser = (customerId, quantity) => {
    return new Promise(async (resolve, reject) => {
        try {
            const stripe = require('stripe')('sk_test_51KNlK1SCiwhjjSk0Wh83gIWl21JdXWfH9Gs9NjQr4sos7VTNRocKbvipbqO0LfpnB6NvattHJwLJaajmxNbyAKT900X1bNAggO');

            const subscription_list = await stripe.subscriptions.list({
                customer: customerId
            });

            const subscription_status = subscription_list.data[0].status;
            const subscription_id = subscription_list.data[0].items.data[0].id;

            if (subscription_status !== 'active') {
                reject(`Subscription should be active but is ${subscription_status}`);
            }

            const usageRecord = await stripe.subscriptionItems.createUsageRecord(
                subscription_id,
                { quantity, timestamp: Math.ceil(Date.now() / 1000) }
            );

            if (usageRecord)
                resolve(usageRecord);
            else
                reject('Unable to create usage record.');
        } catch (error) {
            reject(error.message);
        }
    });
};
