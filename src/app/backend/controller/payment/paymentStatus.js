import Payment from "../../models/payment";
import Wallet from "../../models/wallet";

export async function handlePaymentStatus(method, data) {
    try {
        if (method === "stripe") {
            const payment = new Payment(data);
            return await payment.save();
        } else if (method === "paypal") {
            const payment = new Payment(data);
            return await payment.save();
        } else if (method === "poa") {
            const payment = new Wallet(data);
            return await payment.save();
        }
    } catch (error) {
        console.error("Error saving payment:", error);
        throw new Error("Failed to save payment");
    }
};