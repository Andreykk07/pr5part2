# pr5part2

Architecture Decision Record (ADR)
Context & Problem Statement
При проектуванні системи оформлення замовлень необхідно було вирішити, як саме Order Service взаємодіятиме з Catalog Service для перевірки залишків товарів та їх резервування: синхронно (HTTP REST) чи асинхронно (Message Queue).

Considered Options
Синхронна комунікація (Sync HTTP): Прямі запити від Order Service до Catalog Service за допомогою fetch під час обробки транзакції створення замовлення.

Асинхронна комунікація (Async Message Queue): Публікація подій типу order.created у брокер повідомлень (наприклад, RabbitMQ) та їх обробка в інвентарному сервісі згодом.
