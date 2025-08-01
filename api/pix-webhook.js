// api/pix-webhook.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Inicializa o Prisma Client

module.exports = async (req, res) => {
     if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }
    const webhookData = req.body;
    const orderId = req.query.orderId; // Se você passou o orderId na URL do webhook

    console.log('Webhook de PIX recebido:', webhookData);
    console.log('ID do Pedido (do query param):', orderId);

    // --- IMPORTANTE: Verificação de Segurança do Webhook ---
    // A BlackCat Pagamentos DEVE fornecer um mecanismo de segurança para webhooks,
    // como uma assinatura no cabeçalho (ex: `X-Blackcat-Signature`).
    // VOCÊ DEVE VALIDAR ESSA ASSINATURA AQUI para garantir que a requisição
    // veio realmente da BlackCat e não de um atacante.
    // Exemplo (conceitual - consulte a doc da BlackCat para o real):
    // const signature = req.headers['x-blackcat-signature'];
    // const payloadRaw = JSON.stringify(webhookData); // Depende se a BlackCat envia JSON puro ou form-encoded
    // const isValidSignature = verifyBlackCatSignature(signature, payloadRaw, process.env.BLACKCAT_WEBHOOK_SECRET);
    // if (!isValidSignature) {
    //     console.warn('Webhook recebido com assinatura inválida!');
    //     return res.status(403).send('Forbidden: Invalid signature');
    // }

    if (!orderId) {
        console.error('Webhook recebido sem orderId nos query params. Não é possível processar.');
        return res.status(400).send('Bad Request: Missing orderId');
    }

    try {
        // --- Extrair o status da transação do payload do webhook ---
        // ESTES NOMES DE PROPRIEDADES SÃO EXEMPLOS E PRECISAM SER CONFIRMADOS NA DOCUMENTAÇÃO DA BLACKCAT.
        const transactionIdFromWebhook = webhookData.id || webhookData.transactionId; // ID da transação no gateway
        const statusFromWebhook = webhookData.status || webhookData.paymentStatus; // Status do pagamento

        if (!transactionIdFromWebhook || !statusFromWebhook) {
            console.warn('Webhook payload malformado ou faltando dados essenciais:', webhookData);
            return res.status(400).send('Bad Request: Malformed webhook data');
        }

        // --- Mapear status do gateway para seus status internos ---
        let newOrderStatus;
        switch (statusFromWebhook.toLowerCase()) {
            case 'paid':
            case 'completed':
            case 'approved':
                newOrderStatus = 'paid';
                break;
            case 'cancelled':
            case 'failed':
            case 'expired':
                newOrderStatus = 'cancelled'; // Ou 'failed', 'expired' dependendo do seu controle
                break;
            case 'pending':
            case 'processing':
                newOrderStatus = 'awaiting_pix_payment'; // Se o status ainda é pendente, mantenha ou atualize
                break;
            default:
                console.warn(`Status desconhecido do webhook: ${statusFromWebhook}`);
                return res.status(200).send('Status desconhecido, nada a fazer.'); // Não é um erro, apenas não processamos
        }

        // --- Atualizar o status do pedido no seu banco de dados ---
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: newOrderStatus,
                transactionId: transactionIdFromWebhook, // Garante que o ID da transação seja salvo
                updatedAt: new Date()
            }
        });

        console.log(`Pedido ${updatedOrder.id} atualizado para status: ${updatedOrder.status}`);

        // --- Lógica de Negócio Pós-Pagamento ---
        if (newOrderStatus === 'paid') {
            // Aqui você dispararia ações como:
            // - Enviar e-mail de confirmação do pedido.
            // - Liberar acesso a um produto digital.
            // - Notificar o setor de logística.
            // - Atualizar estoque.
            console.log(`Lógica de negócio para pagamento confirmado do pedido ${updatedOrder.id}`);
        }

        res.status(200).send('Webhook processado com sucesso!');

    } catch (error) {
        console.error('Erro ao processar webhook ou atualizar DB:', error);
        res.status(500).send('Erro interno ao processar webhook.');
    } finally {
        await prisma.$disconnect();
    }
};

// --- Função de Verificação de Assinatura (Exemplo Conceitual) ---
// Você precisaria implementar isso com base na documentação da BlackCat
/*
function verifyBlackCatSignature(signatureHeader, payload, secret) {
    // Exemplo: Alguns gateways usam HMAC-SHA256
    // const crypto = require('crypto');
    // const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // return `sha256=${hash}` === signatureHeader;
    console.warn("ATENÇÃO: A VERIFICAÇÃO DE ASSINATURA DO WEBHOOK NÃO ESTÁ IMPLEMENTADA. ISSO É CRÍTICO PARA A SEGURANÇA!");
    return true; // POR FAVOR, NÃO USE ISSO EM PRODUÇÃO!
}
*/