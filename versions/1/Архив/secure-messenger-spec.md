# Спецификация защищенного мессенджера для iPhone

## Основные требования
1. **Защищенный вход**
   - Вход по паролю/PIN-коду
   - Опция биометрической аутентификации (Face ID/Touch ID)
   - Автоматическая блокировка при неактивности
   - Ограничение попыток ввода пароля

2. **Шифрование сообщений**
   - Сквозное шифрование (E2EE) для всех сообщений
   - Использование алгоритма AES-256 для шифрования содержимого
   - Протокол Signal (или аналогичный) для обмена ключами
   - Защита метаданных коммуникации
   - Perfect Forward Secrecy для защиты от компрометации ключей

3. **Управление сообщениями**
   - Возможность удаления сообщений на своем устройстве
   - Функция удаленного удаления сообщений (с устройства собеседника)
   - Настройка автоматического удаления сообщений по таймеру
   - Полное удаление чата с обеих сторон

4. **Дополнительные функции безопасности**
   - Режим "скрытого приложения" (маскировка под другое приложение)
   - Защита от скриншотов
   - Функция "тревожный пароль" (отдельный пароль, при вводе которого показывается пустой интерфейс)
   - Предотвращение локального кэширования данных
   - Проверка целостности программного обеспечения

## Техническая реализация

### Структура приложения
- **Frontend**: Swift UI для создания нативного iOS интерфейса
- **Backend**: Серверная часть на Node.js или Go для минимальной обработки данных
- **База данных**: Локальное хранилище с шифрованием на устройстве, минимальное хранение данных на сервере

### Протокол шифрования
1. **Алгоритмы шифрования**:
   - Асимметричное шифрование: Кривые ECDH P-256/P-384
   - Симметричное шифрование: AES-256 в режиме GCM
   - Хеширование: SHA-256/512
   - Key Derivation Function: Argon2

2. **Процесс обмена ключами**:
   - Генерация ключевых пар при регистрации
   - Протокол тройного обмена Диффи-Хеллмана для создания сессионных ключей
   - Ротация ключей после определенного количества сообщений

3. **Модель угроз**:
   - Защита от MITM-атак через проверку отпечатков ключей
   - Защита от атак повторного воспроизведения
   - Защита целостности сообщений через HMAC

### Удаленное удаление сообщений
1. **Механизм**:
   - Отправка подписанных команд удаления через защищенный канал
   - Подтверждение выполнения удаления
   - Аудит событий удаления (опционально)

2. **Типы удаления**:
   - Удаление конкретного сообщения
   - Удаление всей истории переписки
   - Экстренное удаление всех данных (функция "тревожная кнопка")

### Соответствие нормативным требованиям
- Соответствие GDPR/CCPA для обработки персональных данных
- Политика прозрачности хранения и обработки данных
- Отсутствие бэкдоров и возможности дешифрования третьими сторонами

## Пользовательский интерфейс

### Ключевые экраны
1. **Экран входа**:
   - Поле ввода пароля/PIN-кода
   - Опция биометрической аутентификации
   - Кнопка экстренной блокировки

2. **Список чатов**:
   - Индикация уровня безопасности чата
   - Индикация включенного автоудаления
   - Опции сортировки и фильтрации

3. **Экран чата**:
   - Индикация статуса шифрования
   - Опции управления сообщениями (удаление, таймер)
   - Индикация проверки ключей собеседника

4. **Настройки безопасности**:
   - Управление ключами шифрования
   - Настройка автоматического удаления
   - Настройка тревожных функций

## План разработки

1. **Этап 1**: Базовая функциональность
   - Вход по паролю
   - Локальное шифрование данных
   - Основной интерфейс обмена сообщениями

2. **Этап 2**: Расширенное шифрование
   - Имплементация E2EE
   - Обмен ключами
   - Проверка целостности сообщений

3. **Этап 3**: Управление сообщениями
   - Локальное удаление
   - Удаленное удаление
   - Таймеры автоудаления

4. **Этап 4**: Продвинутые функции безопасности
   - Тревожный пароль
   - Защита от скриншотов
   - Аудит безопасности

## Рекомендации по имплементации

- Использование проверенных библиотек шифрования (не создавать собственные)
- Минимизация хранения данных на сервере
- Регулярное обновление криптографических алгоритмов
- Проведение независимого аудита безопасности
- Публикация исходного кода ключевых компонентов для проверки сообществом