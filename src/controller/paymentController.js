import TransactionModel from "../models/transactionModel.js";

export const handlePayment = async (req, res) => {
    try {
        const query = req.query; // transaction_status
        const body = req.body; // transaction_id, status
        const orderId = body.order_id;
        switch (query.transaction_status) {
            case "capture":
            case "settlement":
                await TransactionModel.findByIdAndUpdate(orderId, {
                    status: "success"
                });
                break;
            case "deny":
            case "cancel":
            case "expire":
            case "failure":
                await TransactionModel.findByIdAndUpdate(orderId, {
                    status: "failed"
                });
                break;
            default:
                break;
            }
            return res.json({ 
                message: "Handle Payment Success", 
                data:{} 
            });
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ 
            message: "Internal server error" 
        });
    }
}