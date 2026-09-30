import { z } from 'zod'

export const MESSAGE_LENGTH_LIMIT = 4096

export const credentialsSchema = z.object({
  idInstance: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, 'Введите ID инстанса из личного кабинета'),
  apiTokenInstance: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{10,256}$/, 'Проверьте API-токен'),
  apiUrl: z
    .string()
    .trim()
    .url('Введите адрес сервера API')
    .superRefine((value, context) => {
      if (!URL.canParse(value)) return
      const url = new URL(value)
      if (
        url.protocol !== 'https:' ||
        !/^(?:[a-z0-9-]+\.)*green-api\.com$/.test(url.hostname) ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Используйте HTTPS-адрес API на green-api.com из личного кабинета',
        })
      }
    })
    .transform((value) => new URL(value).origin),
})

export type Credentials = z.infer<typeof credentialsSchema>

export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => /^\+?[\d\s()-]+$/.test(value), 'Введите номер телефона')
  .transform((value) => value.replace(/[\s()+-]/g, ''))
  .refine(
    (value) => /^[1-9]\d{6,14}$/.test(value),
    'Введите международный номер: от 7 до 15 цифр с кодом страны',
  )

export const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^@[a-zA-Z0-9_]{1,32}$/,
    'Введите @username: латинские буквы, цифры и подчёркивания',
  )
  .transform((value) => value.toLowerCase())

export const recipientSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const result = value.startsWith('@')
      ? usernameSchema.safeParse(value)
      : phoneSchema.safeParse(value)
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        message:
          result.error.issues[0]?.message ?? 'Введите телефон или @username',
      })
      return z.NEVER
    }
    return result.data
  })

export const accountLookupSchema = z.union([
  z.object({
    exist: z.boolean(),
    chatId: z.string(),
    username: z.string().optional(),
    phoneNumber: z.number().int().nonnegative().optional(),
  }),
  z.object({
    status: z.literal(false),
    reason: z.string().optional(),
    data: z
      .object({
        reason: z.string(),
        retryAfter: z.number().optional(),
      })
      .optional(),
  }),
])

export const messageSchema = z
  .string()
  .trim()
  .min(1, 'Введите сообщение')
  .max(MESSAGE_LENGTH_LIMIT, 'Максимум 4 096 символов')

export const notificationSchema = z
  .object({
    receiptId: z.number().int().nonnegative(),
    body: z.unknown(),
  })
  .nullable()

const senderSchema = z.object({
  chatId: z.string(),
  chatName: z.string().optional(),
  senderName: z.string().optional(),
  senderContactName: z.string().optional(),
  senderPhoneNumber: z.union([z.string(), z.number()]).optional(),
  chatType: z.string().optional(),
})

export const messageEventSchema = z.object({
  typeWebhook: z.enum([
    'incomingMessageReceived',
    'outgoingMessageReceived',
    'outgoingAPIMessageReceived',
  ]),
  idMessage: z.string(),
  timestamp: z.number(),
  senderData: senderSchema,
  messageData: z.object({
    typeMessage: z.string(),
    textMessageData: z.object({ textMessage: z.string() }).optional(),
    extendedTextMessageData: z.object({ text: z.string() }).optional(),
  }),
})

export const statusEventSchema = z.object({
  typeWebhook: z.literal('outgoingMessageStatus'),
  chatId: z.string(),
  idMessage: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed', 'noAccount']),
})

export const stateEventSchema = z.object({
  typeWebhook: z.literal('stateInstanceChanged'),
  stateInstance: z.string(),
})

export type Notification = NonNullable<z.infer<typeof notificationSchema>>
