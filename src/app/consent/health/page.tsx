import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, Section } from '@/components/LegalDoc';
import { APP_NAME, HEALTH_CONSENT_VERSION, OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Согласие на обработку сведений о состоянии здоровья — Впаре',
  description: 'Отдельное согласие на дни цикла во Впаре.',
};

/*
  Cycle marks are health data — a special category (ст. 10 152-ФЗ). Its own
  consent, given when tracking is switched on; switching it off withdraws it
  and deletes the marks (bp_withdraw_health_consent, 0023).
*/
export default function HealthConsentPage() {
  const a = (href: string, text: string) => (
    <Link href={href} className="font-medium text-accent hover:opacity-80">
      {text}
    </Link>
  );

  return (
    <LegalDoc title="Согласие на обработку сведений о состоянии здоровья" version={HEALTH_CONSENT_VERSION}>
      <p>
        Включая «Отмечать дни цикла» в приложении {APP_NAME} и отмечая «Я даю согласие», я, пользователь, которого приложение узнаёт по адресу
        электронной почты моего аккаунта, своей волей и в своём интересе даю оператору — {OPERATOR.name}, {OPERATOR.status}, ИНН {OPERATOR.inn},
        адрес: {OPERATOR.address} — согласие на обработку сведений о состоянии моего здоровья на условиях ниже.
      </p>

      <Section n={1} title="Какие данные">
        <p>Даты, которые я отмечу как дни цикла.</p>
      </Section>

      <Section n={2} title="Зачем">
        <p>
          Чтобы отметка показывалась мне в окне дня и в календаре и попадала в выгрузку моих данных, если я сам(а) её запрошу. Партнёру по
          пространству эти отметки не показываются.
        </p>
      </Section>

      <Section n={3} title="Что с ними можно делать">
        <p>
          Сбор, запись, хранение, извлечение, использование (показ мне), удаление и уничтожение — с использованием средств автоматизации. Данные
          хранятся у обработчика Supabase на серверах в Ирландии (ЕС), и на такую трансграничную передачу я тоже согласен(на).
        </p>
      </Section>

      <Section n={4} title="Срок и отзыв">
        <p>
          Согласие действует, пока включено отслеживание цикла. Чтобы его отозвать, достаточно выключить «Отмечать дни цикла» в{' '}
          {a('/settings/personal', 'Профиль → Личные и данные')}: обработка прекращается, а все отметки сразу удаляются. Также можно написать
          оператору на {OPERATOR.email}.
        </p>
      </Section>

      <p className="text-subhead text-ink-soft">
        Подробно о том, как обрабатываются данные, — в {a('/privacy', 'Политике обработки персональных данных')}.
      </p>
    </LegalDoc>
  );
}
