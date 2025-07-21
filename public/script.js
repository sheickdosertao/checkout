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

               pixArea.style.display = 'block';
        form.style.display = 'none';

        // --- Começa a monitorar o status do pagamento (polling) ---
        // Você precisa do orderId que o backend retornou
        const checkPaymentStatus = async (orderId) => {
            try {
                // Seu backend precisaria de uma nova rota: /api/check-payment-status?orderId=...
                const statusResponse = await fetch(`/api/check-payment-status?orderId=${orderId}`);
                if (!statusResponse.ok) throw new Error('Falha ao verificar status');
                const statusData = await statusResponse.json();

                if (statusData.status === 'paid') {
                    paymentStatus.textContent = "✅ Pagamento Confirmado! Redirecionando...";
                    paymentStatus.style.color = '#00a86b';
                    clearInterval(pollInterval); // Para o polling
                    setTimeout(() => {
                        window.location.href = '/sucesso-pagamento.html'; // Redireciona para página de sucesso
                    }, 3000);
                } else if (statusData.status === 'cancelled' || statusData.status === 'expired' || statusData.status === 'failed_gateway_call') {
                    paymentStatus.textContent = `❌ Pagamento ${statusData.status}! Por favor, tente novamente.`;
                    paymentStatus.style.color = '#dc3545';
                    clearInterval(pollInterval); // Para o polling
                } else {
                    paymentStatus.textContent = "Aguardando pagamento...";
                    paymentStatus.style.color = '#007bff';
                }
            } catch (error) {
                console.error('Erro ao verificar status do pagamento:', error);
                paymentStatus.textContent = "Erro ao verificar status. Por favor, recarregue a página.";
                paymentStatus.style.color = '#ffc107';
                clearInterval(pollInterval);
            }
        };

        // Iniciar polling a cada 3 segundos
        const pollInterval = setInterval(() => checkPaymentStatus(pixData.orderId), 3000);

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