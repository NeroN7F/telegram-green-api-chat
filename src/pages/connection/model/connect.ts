import {
  ApiError,
  createGreenApi,
  type Credentials,
} from '@/shared/api/green-api'

export async function validateConnection(
  credentials: Credentials,
  signal: AbortSignal,
) {
  const api = createGreenApi(credentials)
  const state = await api.getState(signal)
  if (state.stateInstance !== 'authorized') {
    throw new ApiError(
      'Инстанс ещё не авторизован. Подключите Telegram в личном кабинете GREEN-API.',
      401,
    )
  }
  const settings = await api.getSettings(signal)
  if (settings.typeInstance !== 'telegram') {
    throw new ApiError('Для этого приложения нужен инстанс Telegram.', 400)
  }
  if (settings.webhookUrl || settings.incomingWebhook !== 'yes') {
    throw new ApiError(
      'В настройках GREEN-API включите входящие уведомления и очистите Webhook URL. После сохранения подождите минуту.',
      400,
    )
  }
}
