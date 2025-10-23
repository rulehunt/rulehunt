/**
 * Authentication Modal Component
 *
 * Provides login and signup UI for user authentication.
 * Issue #7: Add user authentication and device linking
 */

import { getUserId, setAuthToken, setUserEmail } from '../../identity'

export interface AuthModalElements {
  overlay: HTMLDivElement
  modal: HTMLDivElement
  header: HTMLDivElement
  title: HTMLHeadingElement
  closeBtn: HTMLButtonElement
  content: HTMLDivElement
  emailInput: HTMLInputElement
  passwordInput: HTMLInputElement
  errorMessage: HTMLDivElement
  buttonContainer: HTMLDivElement
  loginBtn: HTMLButtonElement
  signupBtn: HTMLButtonElement
}

/**
 * Configuration for auth modal callbacks
 */
export interface AuthModalConfig {
  onSuccess: (userId: string, email: string) => void
  onClose: () => void
}

/**
 * Create all DOM elements for the auth modal
 */
export function createAuthModal(config: AuthModalConfig): AuthModalElements {
  // Create modal overlay
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 bg-black/80 flex justify-center items-center z-[10000]'
  overlay.style.display = 'none'

  // Create modal content
  const modal = document.createElement('div')
  modal.className =
    'bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-[90%] shadow-2xl'

  // Modal header
  const header = document.createElement('div')
  header.className = 'flex justify-between items-center mb-6'

  const title = document.createElement('h2')
  title.textContent = 'Sign In / Sign Up'
  title.className =
    'm-0 text-2xl text-gray-900 dark:text-gray-100 font-semibold'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.className =
    'border-none bg-transparent text-4xl cursor-pointer p-0 w-8 h-8 leading-8 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
  closeBtn.addEventListener('click', () => {
    hideAuthModal(overlay)
    config.onClose()
  })

  header.appendChild(title)
  header.appendChild(closeBtn)

  // Content area
  const content = document.createElement('div')
  content.className = 'auth-content'

  // Email input
  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.placeholder = 'Email'
  emailInput.className =
    'w-full px-4 py-3 mb-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base box-border focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Password input
  const passwordInput = document.createElement('input')
  passwordInput.type = 'password'
  passwordInput.placeholder = 'Password (min 8 characters)'
  passwordInput.className =
    'w-full px-4 py-3 mb-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base box-border focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Error message
  const errorMessage = document.createElement('div')
  errorMessage.className =
    'text-red-600 dark:text-red-400 text-sm mb-3 min-h-[20px]'
  errorMessage.style.display = 'none'

  // Button container
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'flex gap-3 mt-4'

  // Login button
  const loginBtn = document.createElement('button')
  loginBtn.textContent = 'Login'
  loginBtn.className =
    'flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none px-6 py-3 text-base font-semibold rounded cursor-pointer transition-colors'
  loginBtn.addEventListener('click', async () => {
    await handleLogin(
      emailInput.value,
      passwordInput.value,
      errorMessage,
      config,
      overlay,
    )
  })

  // Signup button
  const signupBtn = document.createElement('button')
  signupBtn.textContent = 'Sign Up'
  signupBtn.className =
    'flex-1 bg-green-600 hover:bg-green-700 text-white border-none px-6 py-3 text-base font-semibold rounded cursor-pointer transition-colors'
  signupBtn.addEventListener('click', async () => {
    await handleSignup(
      emailInput.value,
      passwordInput.value,
      errorMessage,
      config,
      overlay,
    )
  })

  buttonContainer.appendChild(loginBtn)
  buttonContainer.appendChild(signupBtn)

  // Assemble content
  content.appendChild(emailInput)
  content.appendChild(passwordInput)
  content.appendChild(errorMessage)
  content.appendChild(buttonContainer)

  // Assemble modal
  modal.appendChild(header)
  modal.appendChild(content)
  overlay.appendChild(modal)

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAuthModal(overlay)
      config.onClose()
    }
  })

  // Allow Enter key to submit
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginBtn.click()
    }
  })

  return {
    overlay,
    modal,
    header,
    title,
    closeBtn,
    content,
    emailInput,
    passwordInput,
    errorMessage,
    buttonContainer,
    loginBtn,
    signupBtn,
  }
}

/**
 * Show the auth modal
 */
export function showAuthModal(elements: AuthModalElements): void {
  elements.overlay.style.display = 'flex'
  elements.emailInput.focus()
  elements.errorMessage.style.display = 'none'
  elements.emailInput.value = ''
  elements.passwordInput.value = ''
}

/**
 * Hide the auth modal
 */
export function hideAuthModal(overlay: HTMLDivElement): void {
  overlay.style.display = 'none'
}

/**
 * Display error message in modal
 */
function showError(errorElement: HTMLDivElement, message: string): void {
  errorElement.textContent = message
  errorElement.style.display = 'block'
}

/**
 * API response types
 */
interface AuthResponse {
  ok: boolean
  userId?: string
  token?: string
  error?: string
}

/**
 * Handle login button click
 */
async function handleLogin(
  email: string,
  password: string,
  errorElement: HTMLDivElement,
  config: AuthModalConfig,
  overlay: HTMLDivElement,
): Promise<void> {
  try {
    // Validate inputs
    if (!email || !password) {
      showError(errorElement, 'Please enter email and password')
      return
    }

    // Call login API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: getUserId(),
      }),
    })

    const result = (await response.json()) as AuthResponse

    if (!response.ok || !result.ok) {
      showError(errorElement, result.error || 'Login failed')
      return
    }

    // Store auth token and email
    if (!result.token || !result.userId) {
      showError(errorElement, 'Invalid response from server')
      return
    }

    setAuthToken(result.token)
    setUserEmail(email)

    // Hide modal and trigger success callback
    hideAuthModal(overlay)
    config.onSuccess(result.userId, email)
  } catch (error) {
    console.error('[authModal] Login error:', error)
    showError(errorElement, 'Network error. Please try again.')
  }
}

/**
 * Handle signup button click
 */
async function handleSignup(
  email: string,
  password: string,
  errorElement: HTMLDivElement,
  config: AuthModalConfig,
  overlay: HTMLDivElement,
): Promise<void> {
  try {
    // Validate inputs
    if (!email || !password) {
      showError(errorElement, 'Please enter email and password')
      return
    }

    if (password.length < 8) {
      showError(errorElement, 'Password must be at least 8 characters')
      return
    }

    // Call signup API
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: getUserId(),
      }),
    })

    const result = (await response.json()) as AuthResponse

    if (!response.ok || !result.ok) {
      showError(errorElement, result.error || 'Signup failed')
      return
    }

    // Store auth token and email
    if (!result.token || !result.userId) {
      showError(errorElement, 'Invalid response from server')
      return
    }

    setAuthToken(result.token)
    setUserEmail(email)

    // Hide modal and trigger success callback
    hideAuthModal(overlay)
    config.onSuccess(result.userId, email)
  } catch (error) {
    console.error('[authModal] Signup error:', error)
    showError(errorElement, 'Network error. Please try again.')
  }
}
