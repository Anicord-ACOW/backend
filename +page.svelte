<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '$lib/config';

	let statusMessage = $state('Connecting to Discord...');
	let errorMessage = $state<string | null>(null);

	onMount(async () => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');

		if (!code) {
			errorMessage = 'No authorization code found. Redirecting back to login...';
			setTimeout(() => goto('/login'), 2500);
			return;
		}

		try {
			statusMessage = 'Verifying credentials with the server...';
			const apiUrl = page.data.apiUrl || app.apiUrl;

			// Request the backend to exchange the Discord code for a session/token
			// We include credentials in case the backend sets an HTTP-only cookie.
			const response = await fetch(`${apiUrl}/auth/discord/callback?code=${code}`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				},
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Server returned status: ${response.status}`);
			}

			const data = await response.json();

			// If backend returns a token in the body, store it in cookies & localStorage
			if (data && data.token) {
				document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Lax; Secure`;
				localStorage.setItem('token', data.token);
			}

			statusMessage = 'Success! Welcome to Anicord. Redirecting...';
			setTimeout(() => goto('/dashboard'), 1200);
		} catch (err) {
			console.error('Authentication callback error:', err);
			errorMessage = 'Failed to authenticate. The session code may be expired or invalid.';
			setTimeout(() => goto('/login?error=auth_failed'), 3500);
		}
	});
</script>

<svelte:head>
	<title>Authenticating | {app.name}</title>
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-100 px-4 py-12 sm:px-6 lg:px-8">
	<!-- Background decorative glows -->
	<div class="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl filter animate-pulse duration-4000"></div>
	<div class="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-secondary/15 blur-3xl filter animate-pulse duration-6000"></div>
	<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl filter"></div>

	<!-- Card container -->
	<div class="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-base-300/40 bg-base-200/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300">
		<div class="absolute inset-0 -z-10 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/10 opacity-50"></div>

		<div class="flex flex-col items-center text-center space-y-8">
			<!-- Animated loader / status representation -->
			{#if errorMessage}
				<!-- Error state -->
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/20 text-error shadow-lg shadow-error/15 animate-bounce">
					<span class="icon-[tabler--alert-triangle] text-3xl"></span>
				</div>
			{:else}
				<!-- Loading state -->
				<div class="relative flex items-center justify-center">
					<!-- Outer ring -->
					<div class="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
					<!-- Inner logo pulsing -->
					<div class="absolute h-10 w-10 animate-pulse">
						<img src="/Anicord_Logo.png" alt="Logo" class="h-full w-full object-contain opacity-80" />
					</div>
				</div>
			{/if}

			<!-- Text statuses -->
			<div class="space-y-3">
				<h2 class="text-xl font-bold text-base-content">
					{#if errorMessage}
						Authentication Failed
					{:else}
						Completing Sign In
					{/if}
				</h2>
				
				<p class="text-sm {errorMessage ? 'text-error' : 'text-base-content/70'} max-w-xs transition-colors duration-300">
					{errorMessage || statusMessage}
				</p>
			</div>

			<!-- Footer redirect links -->
			{#if errorMessage}
				<div class="pt-4 w-full">
					<a href="/login" class="btn btn-outline btn-error btn-sm w-full gap-2">
						<span class="icon-[tabler--arrow-left] text-sm"></span> Return to Login
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
