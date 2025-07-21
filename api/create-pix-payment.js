// api/create-pix-payment.js

// Importe axios se você decidir usá-lo em vez de fetch nativo,
// caso contrário, não precisa importar nada para o fetch nativo (Node.js 18+)
// const axios = require('axios'); // Se preferir axios, descomente esta linha e remova 'fetch'

module.exports = async (req, res) => {
    // As variáveis de ambiente da Vercel são acessadas via process.env
    const url = process.env.BLACKCAT_API_URL || 'https://api.blackcatpagamentos.com/v1/transactions';
    const publicKey = process.env.BLACKCAT_PUBLIC_KEY;
    const secretKey = process.env.BLACKCAT_SECRET_KEY;

    // A Vercel já faz o parsing do JSON para você em `req.body`
    const { amount, description, nome, email, cpfCnpj } = req.body;

    // --- Validações básicas (adicione mais validações em produção!) ---
    if (!amount || !description || !nome || !email || !cpfCnpj) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ error: 'O valor deve ser positivo.' });
    }
    // Adicione validação de formato de email, CPF/CNPJ, etc.

    try {
        // --- Criando a autenticação Basic ---
        // Certifique-se de que publicKey e secretKey estão definidos nas variáveis de ambiente da Vercel.
        if (!publicKey || !secretKey) {
            console.error("Chaves de API da BlackCat não configuradas nas variáveis de ambiente.");
            return res.status(500).json({ error: 'Configuração do gateway de pagamento incompleta.' });
        }
        const auth = 'Basic ' + Buffer.from(publicKey + ':' + secretKey).toString('base64');

        // --- Payload para a BlackCat Pagamentos ---
        // Adapte os campos `customer`, `items`, etc., conforme a documentação da BlackCat.
        const payload = {
            amount: amount, // O valor em centavos já vem do seu frontend
            paymentMethod: 'pix',
            description: description,
            customer: { // Exemplo de estrutura, verifique a doc da BlackCat
                name: nome,
                email: email,
                document: {
                    type: cpfCnpj.length === 11 ? 'CPF' : 'CNPJ', // Lógica simples para determinar tipo
                    number: cpfCnpj.replace(/\D/g, '') // Remove caracteres não numéricos
                }
            },
            // Adicione aqui outros campos que a BlackCat Pagamentos exige
            // como `notificationUrl` para o webhook. Por exemplo:
            notificationUrl: `${process.env.YOUR_APP_URL}/api/pix-webhook`
            // Ou `expirationTimeInMinutes`
        };

        // --- Requisição POST para a API da BlackCat Pagamentos ---
        const response = await fetch(url, { // Ou axios.post(url, payload, { headers: ... }) se usar axios
            method: 'POST',
            headers: {
                Authorization: auth,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // Verificação se a resposta foi bem-sucedida (status 2xx)
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro na resposta da BlackCat:', errorData);
            // Lança um erro para ser pego no bloco catch
            throw new Error(`Erro do Gateway de Pagamento: ${errorData.message || JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Resposta da BlackCat:', data);

        // --- Extrair dados do PIX da resposta da BlackCat ---
        // Os nomes das propriedades abaixo (`qrCode`, `qrCodeText`, `transactionId`)
        // são exemplos. Você PRECISA consultar a documentação da API da BlackCat
        // para saber os nomes EXATOS das propriedades que contêm o QR Code e o código copia e cola.
        const qrCodeImageBase64 = data.qrCode || data.pix.qrCodeImage; // Exemplo de como a BlackCat pode retornar
        const pixCopiaECola = data.qrCodeText || data.pix.copyPasteCode; // Exemplo de como a BlackCat pode retornar
        const transactionId = data.id || data.transactionId; // ID da transação na BlackCat

        // --- Salvar o status do pedido no seu banco de dados (externo) ---
        // Aqui você salvaria o 'transactionId', 'amount', 'status: "pending"',
        // etc. no seu DB.
        console.log(`PIX gerado. ID da Transação na BlackCat: ${transactionId}`);
        // Ex: await db.saveOrder({ transactionId, amount, status: 'pending', customerId, ... });

        // Retorna os dados do PIX para o frontend
        res.status(200).json({
            qrCodeImageBase64: qrCodeImageBase64,
            pixCopiaECola: pixCopiaECola,
            transactionId: transactionId
        });

    } catch (error) {
        console.error('Erro na requisição para a BlackCat:', error);
        res.status(500).json({ error: 'Erro ao gerar pagamento PIX. Por favor, tente novamente mais tarde.' });
    }
};