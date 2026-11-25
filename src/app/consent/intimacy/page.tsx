import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, Section } from '@/components/LegalDoc';
import { APP_NAME, INTIMACY_CONSENT_VERSION, OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Согласие на обработку сведений об интимной жизни — Впаре',
  description: 'Отдельное согласие на отметки близости во Впаре.',
};

/*
  Intimacy marks are information about intimate life — a special category
  (ст. 10 152-ФЗ). Each partner gives this consent; the marks exist only while
  both have it. Switching off withdraws it and deletes the couple's marks
  (bp_withdraw_intimacy_consent, 0024).
*/
export default function IntimacyConsentPage() {
  const a = (href: string, text: string) => (
    <Link href={href} className="font-medium text-accent hover:opacity-80">
      {text}
    </Link>
  );

  return (
    <LegalDoc title="Согласие на обработку сведений об интимной жизни" version={INTIMACY_CONSENT_VERSION}>
      <p>
        Включая «Отмечать близость» в приложении {APP_NAME} и отмечая «Я даю согласие», я, пользователь, которого приложение узнаёт по адресу
        электронной почты моего аккаунта, своей волей и в своём интересе даю оператору — {OPERATOR.name}, {OPERATOR.status}, ИНН {OPERATOR.inn},
        адрес: {OPERATOR.address} — согласие на обработку сведений о моей интимной жизни на условиях ниже.
      </p>

      <Section n={1} title="Какие данные">
        <p>Даты, которые я или мой партнёр по пространству отметим как дни близости, и кто поставил отметку.</p>
      </Section>

      <Section n={2} title="Зачем">
        <p>
          Чтобы отметка показывалась нам обоим на главном экране и в календаре и попадала в выгрузку моих данных, если я сам(а) её запрошу.
          Отметка общая для пары: она видна мне и моему партнёру по пространству и никому больше. Отметки существуют, только пока такое согласие
          дали мы оба.
        </p>
      </Section>

      <Section n={3} title="Что с ними можно делать">
        <p>
          Сбор, запись, хранение, извлечение, использование (показ мне и партнёру), предоставление доступа партнёру по пространству, удаление и
          уничтожение — с использованием средств автоматизации. Данные хранятся у обработчика Supabase на серверах в Ирландии (ЕС), и на такую
          трансграничную передачу я тоже согласен(на).
        </p>
      </Section>

      <Section n={4} title="Срок и отзыв">
        <p>
          Согласие действует, пока включено «Отмечать близость» и я состою в этой паре. Чтобы его отозвать, достаточно выключить «Отмечать
          близость» в {a('/settings/personal', 'Профиль → Личные и данные')}: обработка прекращается, а все отметки близости нашей пары сразу
          удаляются. То же происходит, если я выхожу из пары. Также можно написать оператору на {OPERATOR.email}.
        </p>
      </Section>

      <p className="text-subhead text-ink-soft">
        Подробно о том, как обрабатываются данные, — в {a('/privacy', 'Политике обработки персональных данных')}.
      </p>
    </LegalDoc>
  );
}
