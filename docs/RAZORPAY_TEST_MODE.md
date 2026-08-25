# Razorpay Test-Mode Plan for Gradely

Gradely can support a future paid feature such as premium courses or subscriptions. For development, keep the integration in Razorpay **Test Mode** only.

## Recommended architecture

```text
React frontend
   |
   | POST /payment/create-order
   v
Gradely backend
   |
   | Razorpay Orders API
   v
Razorpay Test Mode
   |
   | order_id
   v
React Razorpay Checkout
   |
   | payment_id + order_id + signature
   v
Gradely backend
   |
   | HMAC-SHA256 signature verification
   v
MongoDB payment record
```

## Rules

- Never put the Razorpay Key Secret in React/Vite environment variables.
- Keep the secret only on the backend.
- Create the Razorpay order on the server before opening Checkout.
- Verify the returned signature on the server before marking an order paid.
- Store the Razorpay order/payment IDs so duplicate callbacks cannot create duplicate entitlements.
- Use webhooks for authoritative payment-state updates when the feature is productionized.
- Use only `rzp_test_...` credentials during development.

## Gradely data model to add later

A `Payment` collection should contain at least:

- `user`
- `course` or `plan`
- `amount`
- `currency`
- `razorpayOrderId`
- `razorpayPaymentId`
- `status`
- `createdAt`
- `updatedAt`

## Suggested product use

The cleanest Gradely use case is a separate paid feature, for example:

- premium course enrollment
- instructor subscription
- advanced analytics
- institution plan

Do not couple payment state to the basic assignment/submission workflow. A user who has not purchased a premium feature must still be able to use the normal classroom functionality.

## Before production

Live payments require Razorpay account setup/KYC and live API credentials. Keep this project in Test Mode until the payment flow has been fully reviewed and the account owner is ready for production payments.
