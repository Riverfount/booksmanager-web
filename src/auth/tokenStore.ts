// O access token fica só em memória (nunca em localStorage): o refresh token httpOnly
// recupera a sessão quando a página recarrega.
let accessToken: string | null = null

export const getAccessToken = () => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
}
