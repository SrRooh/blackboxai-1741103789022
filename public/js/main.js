// Flash messages
function showMessage(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertDiv);

    // Auto remove after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Form submission handling
document.addEventListener('DOMContentLoaded', function() {
    // Add new link form
    const addLinkForm = document.getElementById('addLinkForm');
    if (addLinkForm) {
        addLinkForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const response = await fetch('/admin/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(new FormData(addLinkForm)),
                });

                if (response.ok) {
                    location.reload();
                } else {
                    showMessage('Erro ao adicionar link', 'danger');
                }
            } catch (error) {
                showMessage('Erro ao adicionar link', 'danger');
            }
        });
    }

    // Edit link forms
    document.querySelectorAll('.edit-link-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = form.dataset.id;
            const formData = new FormData(form);
            
            try {
                const response = await fetch(`/admin/links/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: formData.get('title'),
                        url: formData.get('url'),
                        active: formData.get('active') ? true : false
                    }),
                });
                
                if (response.ok) {
                    showMessage('Link atualizado com sucesso!');
                } else {
                    showMessage('Erro ao atualizar link', 'danger');
                }
            } catch (error) {
                showMessage('Erro ao atualizar link', 'danger');
            }
        });
    });

    // Delete link buttons
    document.querySelectorAll('.delete-link').forEach(button => {
        button.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja excluir este link?')) {
                const id = button.dataset.id;
                try {
                    const response = await fetch(`/admin/links/${id}`, {
                        method: 'DELETE',
                    });
                    
                    if (response.ok) {
                        button.closest('.link-item').remove();
                        showMessage('Link excluído com sucesso!');
                    } else {
                        showMessage('Erro ao excluir link', 'danger');
                    }
                } catch (error) {
                    showMessage('Erro ao excluir link', 'danger');
                }
            }
        });
    });
});

// Prevent form submission on enter key for link editing
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && event.target.closest('.edit-link-form')) {
        event.preventDefault();
    }
});