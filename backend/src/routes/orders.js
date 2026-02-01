import { getQuote } from '../services/quotes.js';
import { placeOrder } from '../services/orders.js';

export async function quoteSymbol(request, reply) {
  const { symbol } = request.params || {};
  const result = await getQuote(symbol);
  if (result.error) {
    return reply.status(400).send({ success: false, error: result.error });
  }
  return reply.send({ success: true, ...result });
}

export async function createOrder(request, reply) {
  const body = request.body || {};
  const result = await placeOrder(request.agent.id, body);
  if (!result.success) {
    return reply.status(400).send({ success: false, error: result.error, ...result });
  }
  return reply.status(201).send({ success: true, ...result });
}
