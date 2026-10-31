import { api, call } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ChangePasswordForm } from './ChangePasswordForm'
import { Dialog } from './ui'

/**
 * The administrator or operator changes their own password. The API ends every session of the user on success, so the
 * next step is to sign in again: the user is signed out at once and the login screen says so. The reader changes the
 * password in "Meus dados".
 */
export function ChangeOwnPasswordDialog({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth()
  return (
    <Dialog title="Alterar senha" onClose={onClose}>
      <p className="m-0 text-sm text-fg2">Ao trocar a senha, todas as suas sessões são encerradas e você entra de novo com a nova senha.</p>
      <ChangePasswordForm
        send={(body) => call(api.POST('/api/v1/users/me/password', { body }))}
        onDone={() => void signOut('Senha trocada. Entre de novo com a nova senha.')}
        onCancel={onClose}
      />
    </Dialog>
  )
}
