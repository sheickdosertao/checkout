// api/pix-webhook.js
module.exports = async (req, res) => {
    const webhookData = req.body;
    console.log('Webhook de PIX recebido:', webhookData);

    // --- Processamento do Webhook ---
    // 1. **Verificar a assinatura do webhook (MUITO IMPORTANTE para segurança!):**
    //    Quase todos os gateways enviam um header como 'x-hub-signature' ou similar
    //    que você deve usar para verificar a autenticidade da requisição.
    //    Ex: const signature = req.headers['x-hub-signature'];
    //    const isValid = verifyWebhookSignature(signature, JSON.stringify(webhookData), 'YOUR_WEBHOOK_SECRET');
    //    if (!isValid) return res.status(403).send('Forbidden: Invalid Signature');

    // 2. **Identificar a transação:** Pegue o ID da transação ou do pedido.
    //    Ex: const transactionId = webhookData.data.id || webhookData.payment.id;

    // 3. **Atualizar o status no seu banco de dados:**
    //    - Se o status for 'paid', 'approved', 'completed':
    //      - Atualize o status do pedido para 'pago'.
    //      - Libere o produto/serviço.
    //      - Envie e-mails de confirmação.
    //    - Se o status for 'cancelled', 'failed', 'expired':
    //      - Atualize o status para 'cancelado'/'falhou'.

    // Exemplo simplificado (NÃO USE EM PRODUÇÃO SEM VALIDAÇÃO DE ASSINATURA E DB REAL):
    // if (webhookData.type === 'payment.succeeded' && webhookData.data.status === 'approved') {
    //     console.log(`Pagamento ID ${webhookData.data.id} confirmado!`);
    //     // Lógica para atualizar DB e liberar produto
    // }

    res.status(200).send('Webhook recebido com sucesso!');
};