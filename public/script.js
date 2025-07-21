document.getElementById('checkoutForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.amount = 15000; // R$ 150,00 em centavos (exemplo)
    data.description = "Pedido #12345 - Produto Exemplo";

    const loadingSpinner = document.getElementById('loadingSpinner');
    const pixArea = document.getElementById('pix-area');
    const qrCodeImage = document.getElementById('qrCodeImage');
    const pixCodeInput = document.getElementById('pixCode');
    const paymentStatus = document.getElementById('payment-status');

    loadingSpinner.style.display = 'block';
    form.querySelector('button[type="submit"]').disabled = true;

    try {
        // AQUI ESTÁ A MUDANÇA PRINCIPAL:
        // Chamando a Serverless Function hospedada na Vercel
        const response = await fetch('/api/create-pix-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro ao gerar PIX: ${errorData.error || response.statusText}`);
        }

        const pixData = await response.json();

        qrCodeImage.src = pixData.qrCodeImageBase64;
        pixCodeInput.value = pixData.pixCopiaECola;
        paymentStatus.textContent = "Aguardando pagamento...";

        pixArea.style.display = 'block';
        form.style.display = 'none';

        // Em um cenário real, você teria uma forma de monitorar o status do pagamento,
        // seja por polling (requisições repetidas para uma API sua que verifica o status)
        // ou, idealmente, por WebSockets para receber atualizações do backend (disparadas por webhook).
        // Para este exemplo simples, não implementaremos o monitoramento contínuo aqui.

    } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        alert('Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.\nDetalhes: ' + error.message);
    } finally {
        loadingSpinner.style.display = 'none';
        form.querySelector('button[type="submit"]').disabled = false;
    }
});

document.getElementById('copy-button').addEventListener('click', function() {
    const pixCodeInput = document.getElementById('pixCode');
    pixCodeInput.select();
    pixCodeInput.setSelectionRange(0, 99999);
    document.execCommand('copy');
    alert('Código PIX copiado!');
});