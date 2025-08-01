// api/check-payment-status.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
     if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }
    const orderId = req.query.orderId;

    if (!orderId) {
        return res.status(400).json({ error: 'orderId é obrigatório.' });
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true } // Busque apenas o status para otimizar
        });

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        res.status(200).json({ status: order.status });
    } catch (error) {
        console.error('Erro ao buscar status do pedido:', error);
        res.status(500).json({ error: 'Erro interno ao verificar status do pedido.' });
    } finally {
        await prisma.$disconnect();
    }
};