import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { logSignupVerificationEmail, logPasswordResetEmail } from '../utils/emailLogger'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, tenant_id, tenants(name)')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      // Flatten the tenant name for easier access
      const profile = {
        ...data,
        tenant_name: data.tenants?.name || null
      }
      
      setUserProfile(profile)
    } catch (error) {
      console.error('Error fetching user profile:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, role = 'customer', tenantId = null, tenantName = null) => {
    try {
      let finalTenantId = tenantId

      // If owner is registering, create new tenant first
      if (role === 'owner' && tenantName) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .insert([
            {
              name: tenantName,
              subscription_status: 'trial',
              subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 day trial
            }
          ])
          .select()
          .single()

        if (tenantError) throw tenantError
        finalTenantId = tenantData.id
      }

      // For customers and staff without tenant_id, require tenant selection
      if (!finalTenantId && (role === 'customer' || role === 'staff')) {
        throw new Error('Please select a bar location to register with')
      }

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (authError) throw authError

      // 2. Upsert user profile (trigger creates default, we update with role and tenant)
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email,
            role,
            tenant_id: finalTenantId
          }, {
            onConflict: 'id'
          })

        if (profileError) throw profileError

        // 3. Log the verification email that Supabase sent
        await logSignupVerificationEmail(
          email,
          authData.user.id,
          finalTenantId,
          role
        )
      }

      return { data: authData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setUserProfile(null)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const resetPassword = async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      // Log the password reset email
      // Try to get user info, but don't fail if user doesn't exist
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, tenant_id')
        .eq('email', email)
        .single()

      await logPasswordResetEmail(
        email,
        userData?.id || null,
        userData?.tenant_id || null
      )

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
