// api/create-pix-payment.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Inicializa o Prisma Client
const axios = require('axios'); // Vamos manter axios, pois é robusto e amplamente usado

module.exports = async (req, res) => {
    const url = process.env.BLACKCAT_API_URL || 'https://api.blackcatpagamentos.com/v1/transactions';
    const publicKey = process.env.BLACKCAT_PUBLIC_KEY;
    const secretKey = process.env.BLACKCAT_SECRET_KEY;
    const yourAppUrl = process.env.YOUR_APP_URL; // Seu domínio na Vercel

    const { amount, description, nome, email, cpfCnpj } = req.body;

    // --- Validações ---
     if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }
    if (!amount || !description || !nome || !email || !cpfCnpj) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ error: 'O valor deve ser positivo.' });
    }
    if (!publicKey || !secretKey || !yourAppUrl) {
        console.error("Variáveis de ambiente incompletas para BlackCat ou YOUR_APP_URL.");
        return res.status(500).json({ error: 'Configuração do gateway de pagamento ou URL de retorno incompleta.' });
    }

    try {
        const auth = 'Basic ' + Buffer.from(publicKey + ':' + secretKey).toString('base64');

        // --- 1. Criar um registro de pedido no seu banco de dados (status pendente) ---
        // Isso é crucial ANTES de chamar o gateway, caso a chamada falhe.
        const newOrder = await prisma.order.create({
            data: {
                // transactionId será preenchido após a resposta do gateway
                amount: amount,
                description: description,
                customerName: nome,
                customerEmail: email,
                customerCpfCnpj: cpfCnpj,
                status: 'pending' // Estado inicial
            }
        });

        // --- 2. Payload para a BlackCat Pagamentos ---
        const payload = {
            amount: amount,
            paymentMethod: 'pix',
            description: description,
            customer: {
                name: nome,
                email: email,
                document: {
                    type: cpfCnpj.length === 11 ? 'CPF' : 'CNPJ',
                    number: cpfCnpj.replace(/\D/g, '')
                }
            },
            // IMPORTANTE: Use a URL completa da sua Serverless Function de webhook.
            // A BlackCat precisará saber onde te enviar as notificações.
            notificationUrl: `${yourAppUrl}/api/pix-webhook?orderId=${newOrder.id}`, // Passa o ID do seu pedido
            // Adicione aqui outros campos exigidos pela BlackCat, como expiry_time, etc.
        };

        // --- 3. Requisição POST para a API da BlackCat Pagamentos ---
        const gatewayResponse = await axios.post(url, payload, {
            headers: {
                Authorization: auth,
                'Content-Type': 'application/json',
            },
        });

        const blackCatData = gatewayResponse.data;
        console.log('Resposta da BlackCat:', blackCatData);

        // --- 4. Extrair dados do PIX e atualizar o pedido no DB ---
        // VERIFIQUE A DOCUMENTAÇÃO DA BLACKCAT PARA OS NOMES EXATOS!
        const qrCodeImageBase64 = blackCatData.qrCode || blackCatData.pix.qrCodeImage;
        const pixCopiaECola = blackCatData.qrCodeText || blackCatData.pix.copyPasteCode;
        const transactionId = blackCatData.id || blackCatData.transactionId; // ID da transação na BlackCat

        await prisma.order.update({
            where: { id: newOrder.id },
            data: {
                transactionId: transactionId,
                status: 'awaiting_pix_payment' // Novo status, mais específico
            }
        });

        // 5. Retorna os dados do PIX para o frontend
        res.status(200).json({
            qrCodeImageBase64: qrCodeImageBase64,
            pixCopiaECola: pixCopiaECola,
            transactionId: transactionId,
            orderId: newOrder.id // Retorna o ID do seu pedido também
        });

    } catch (error) {
        console.error('Erro na requisição para a BlackCat ou DB:', error.response ? error.response.data : error.message);

        // Se o pedido foi criado no DB, mas a chamada à BlackCat falhou,
        // você pode querer atualizar o status do pedido para 'failed_creation' ou similar.
        if (newOrder && newOrder.id) {
            await prisma.order.update({
                where: { id: newOrder.id },
                data: { status: 'failed_gateway_call' }
            }).catch(dbErr => console.error('Erro ao atualizar status do pedido após falha no gateway:', dbErr));
        }

        res.status(500).json({ error: 'Erro ao gerar pagamento PIX. Por favor, tente novamente mais tarde.' });
    } finally {
        // Garante que a conexão com o banco de dados seja desconectada
        await prisma.$disconnect();
    }
};