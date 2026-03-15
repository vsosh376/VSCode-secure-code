const PROMPT = `Ты эксперт по безопасности кода. Твоя задача - находить все секреты и конфиденциальные данные в коде.

ТИПЫ СЕКРЕТОВ, КОТОРЫЕ НУЖНО ИСКАТЬ:
- API ключи (OpenAI, AWS, GitHub, Stripe, и т.д.)
- Токены доступа (Bearer tokens, Personal Access Tokens, и т.д.)
- Пароли и credentials
- Строки подключения к базам данных (PostgreSQL, MySQL, MongoDB, и т.д.)
- Webhook URLs (Slack, Discord, и т.д.)
- Приватные ключи (SSH, SSL, PGP, и т.д.)
- Персональные данные (email, телефоны, адреса, и т.д.)
- AWS Access Keys и Secret Keys
- OAuth токены и client secrets

ФОРМАТ ОТВЕТА:
Отвечай ТОЛЬКО в формате JSON словаря, где ключ - имя файла, значение - массив найденных секретов.

ВАЖНО:
- Если видишь в коде структуры "secret_" не обозначай их как секреты. Игнорируй их
- Если секретов не найдено, верни пустой объект: {}
- Проверяй себя: убедись что все найденные значения действительно являются секретами
- Не пропускай закомментированный код - там тоже могут быть секреты
- Ищи секреты в строках, переменных, комментариях, конфигах
- Не проверяй названия файлов
- Если секрет повторяется то в JSON необходимо записать ВСЕ его повтерения, НЕ ДОПУСКАЙ их пропуска
- Отвечай без переносов строк
- Отвечай ТОЛЬКО JSON, без дополнительного текста`;

const PROMPT_CHECK = `Ты эксперт в программировании. Твоя задача - проверять корректность json словаря.

ФОРМАТ ОТВЕТА:
Отвечай ТОЛЬКО в формате корректного JSON словаря.

ВАЖНО:
- Если словарь пустой {}, не меняй его
- Запрещено менять содержимое и структуру словаря
- Проверяй себя: убедись что json объект - действительно корректный словарь
- Отвечай без переносов строк
- Отвечай ТОЛЬКО JSON, без дополнительного текста`;

async function ask(prompt: string, text: string) {
    const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-oss:20b',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: text }
            ],
            stream: false
        })
    });

    const data: any = await res.json();
    return data.message.content;
}

export async function findSecrets(code: string) {
    const raw = await ask(PROMPT, code);
    const checked = await ask(PROMPT_CHECK, raw);

    try {
        return JSON.parse(checked);
    } catch {
        return {};
    }
}
