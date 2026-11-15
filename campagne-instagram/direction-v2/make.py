"""Générateur du lot direction-v2 (10 posts, 3 familles de composition).

Familles :
  A  · iPhone cadré sur panneau sombre + colonne éditoriale   (01, 04, 07)
  B  · bande de capture + colonne de preuves                  (02, 05, 08)
  C  · mosaïque 2x2 plein cadre                               (03, 06, 09, 10)

Le rendu se fait avec render.cjs (Playwright + Chromium headless).
"""
from pathlib import Path

H = Path(__file__).resolve().parent
FRAME = '../presences/assets/iphone-16-pro.webp'


def brand(ix):
    return ('<div class="brandrow"><img src="../presences/assets/logo.png" alt="">'
            '<span class="nm">Rawdha<b>+</b></span>'
            '<span class="ix ltr">%s / 10</span></div>') % ix


def cta(label, color='inherit', size=None):
    st = 'color:%s' % color
    if size:
        st += ';font-size:%spx' % size
    return '<a class="cta" style="%s"><span>%s</span><i class="arw">←</i></a>' % (st, label)


def notes(items, cls='flow'):
    """Timeline d'étapes : occupe la hauteur disponible."""
    return '<div class="%s">%s</div>' % (cls, ''.join(
        '<div class="step"><span class="dot ltr">%s</span>'
        '<div><h3>%s</h3><p>%s</p></div></div>' % i for i in items))


def quote(q, s):
    return '<div class="quote"><div class="q">%s</div><div class="s">%s</div></div>' % (q, s)


def html(cls, inner):
    return ('<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="style.css"></head>\n<body>\n'
            '<main class="post %s">%s</main>\n</body></html>\n') % (cls, inner)


def kpis(cells):
    return '<div class="kpi">%s</div>' % ''.join(
        '<div class="c"><div class="k">%s</div><div class="v %s">%s</div></div>' % (k, c, v)
        for k, v, c in cells)


def quote(q, s):
    return '<div class="quote"><div class="q">%s</div><div class="s">%s</div></div>' % (q, s)


tailkpi_by_idx = {
    '01': [('اعتماد', 'جاهز', 'ok'), ('سجل', 'اليوم', 'nv'), ('تنبيه', 'تلقائي', '')],
    '04': [('مراجعة', '1', 'bad'), ('تحذير', 'قبل', 'nv'), ('تصدير', 'CSV', '')],
    '07': [('حضور', '50%', 'ok'), ('تسجيلات', '2', ''), ('متأخرة', '1', 'bad')],
    '10': [('إعداد', '3/5', ''), ('متبقي', '1', 'bad'), ('وجبات', '0', '')],
}


def thumbs(items):
    return '<div class="thumbs">%s</div>' % ''.join(
        '<div class="t"><div class="im"><img src="assets/%s.jpg" alt=""></div>'
        '<div class="lb"><b>%s</b><span>%s</span></div></div>' % (i[0], i[1], i[2])
        for i in items)


def listing(items):
    return '<div class="lst">%s</div>' % ''.join(
        '<div class="it"><span class="n ltr">%s</span><div><h3>%s</h3><p>%s</p></div></div>'
        % (i[-3], i[-2], i[-1]) for i in items)


def evidence(rows):
    """Cartes-preuves empilées : capture + 2 lignes de texte."""
    return '<div class="ev">%s</div>' % ''.join(
        '<div class="row"><div class="im"><img src="assets/%s.jpg" alt=""></div>'
        '<div class="tx"><span class="num ltr">%s</span><h3>%s</h3><p>%s</p></div></div>' % r
        for r in rows)


def footer(label, ix, dark=False):
    return ('<div class="foot">%s<span class="nm2 ltr">Rawdha+ · %s</span></div>'
            % (cta(label, '#fff' if dark else '#0A1F36', 18), ix))


# ---------------------------------------------------------------- A
def A(ix, dark, kicker, h1, sub, label, screen, stat_k, stat_v, stat_cls, stat_note,
      cap_t, cap_s, kpirow, rows, q, mirror=False):
    tailkpi = tailkpi_by_idx.get(ix, [('نسبة', '100%', ''), ('فئات', '6', ''), ('نوع', '3', '')])
    cls = 'A' + (' dark' if dark else '') + (' mirror' if mirror else '')
    ed = ''.join([
        '<div class="hd">', brand(ix),
        '<p class="kicker">', kicker, '</p>',
        '<h1>', h1, '</h1>',
        '<p class="sub">', sub, '</p></div>',
        kpis(kpirow),
        listing(rows),
        thumbs(rows),
        quote(*q),
        kpis(tailkpi),
        footer(label, ix, dark)])
    lp = ''.join([
        '<div class="lp">',
        '<div class="phone"><div class="mock">',
        '<img class="frame" src="', FRAME, '" alt="">',
        '<div class="scr"><img src="assets/screen-', screen, '.jpg" alt=""></div></div></div>',
        '<div class="statcard"><div class="k">', stat_k, '</div>',
        '<div class="v ', stat_cls, '">', stat_v, '</div>',
        '<div class="t">', stat_note, '</div></div>',
        '<div class="cap"><div class="n ltr">', screen.upper(), '</div>',
        '<div class="t">', cap_t, '</div><div class="s">', cap_s, '</div></div>',
        '<div class="lpfoot"><span class="ltr">Rawdha+</span>'
        '<span class="fr">تسيير الحضانة، ببساطة</span></div>',
        '</div>'])
    return html(cls, lp + '<div class="ed">' + ed + '</div>')


# ---------------------------------------------------------------- B
def B(ix, cover, kicker, h1, sub, kpirow, rows, q, label, cap, bullets=None, mirror=False):
    if bullets is None and len(cap) > 4:
        bullets = cap[4]
    shot = ''.join([
        '<div class="shot"><div class="imw">',
        '<img src="assets/screen-', cover, '.jpg" alt="">',
        '<span class="tag ltr">', cap[0], '</span></div>',
        '<div class="cap"><div class="t">', cap[1], '</div><div class="s">', cap[2], '</div>',
        '<div class="st">', ''.join('<div><b>%s</b> %s</div>' % c for c in cap[4]), '</div>',
        '<div class="kk">', ''.join(
            '<div class="c"><div class="k">%s</div><div class="v ltr">%s</div></div>' % (c[0], c[1])
            for c in cap[3]), '</div></div></div>'])
    ed = ''.join([
        '<div class="hd">', brand(ix),
        '<p class="kicker">', kicker, '</p>',
        '<h1>', h1, '</h1>',
        '<p class="sub">', sub, '</p></div>',
        kpis(kpirow),
        listing(rows),
        thumbs(rows),
        quote(*q),
        footer(label, ix)])
    return html('B mirror' if mirror else 'B',
                shot + '<div class="ed">' + ed + '</div>')


# ---------------------------------------------------------------- C
def snap(screen, n, h, p):
    return ('<div class="snap"><div class="fr">'
            '<img src="assets/screen-%s.jpg" alt=""></div>'
            '<div class="lg"><span class="num ltr">%s</span>'
            '<div><h3>%s</h3><p>%s</p></div></div></div>') % (screen, n, h, p)


def C(ix, kicker, h1, sub, label, chips, snaps, bar, dark=False):
    inner = ''.join([
        '<div class="band">', brand(ix),
        '<div><p class="kicker">', kicker, '</p><h1>', h1, '</h1></div>',
        '<div class="row2"><p class="sub">', sub, '</p><div class="chips">',
        ''.join('<span>%s<b class="ltr">%s</b></span>' % (c[0], c[1]) for c in chips),
        '</div></div></div>',
        '<div class="duo">', ''.join(snaps), '</div>',
        '<div class="bar">', ''.join(
            '<div class="kv"><div class="k">%s</div><div class="v %s ltr">%s</div></div>' % b
            for b in bar),
        '<div class="line"></div>', cta(label, '#fff', 17.5), '</div>',
        '<div class="foot"><span class="ltr">Rawdha+</span>'
        '<span class="fr">تسيير الحضانة، ببساطة</span></div>'])
    return html('C dark' if dark else 'C', inner)


def build():
    P = []

    # 01 · A clair — présences
    P.append(('01-presences', A(
        '01', False, 'ثلاثة أرقام تكفي',
        'الصباح يبدا <b>بسؤال واحد:</b> شكون هنا؟',
        'الحضور والغياب والمتبقي في شاشة وحدة — وسجّل اليوم كامل بضغطة على القسم.',
        'افتحي حضور اليوم', 'presences',
        'الحضور اليوم', '1', 'bad', 'طفل متبقي — والاعتماد بضغطة وحدة.',
        'العدّادات الثلاثة تكفي', 'حاضرون · غائبون · متبقي — في سطر واحد فوق القائمة.',
        [('حاضرون', '0', ''), ('غائبون', '0', ''), ('متبقي', '1', 'bad')],
        [('v01', '01', 'العدّادات', 'متبقي 1 · حاضرون 0 · غائبون 0'),
         ('v03', '02', 'اعتماد اليوم', 'التسجيل يتعتمد ويبقى في السجل.'),
         ('v05', '03', 'سجل الغيابات', 'الغياب غير المبرّر يتجمّع وحدو.')],
        ('«سجل الغيابات المنظّم»', 'العبارة من الشاشة، ماشي شعار.'))))

    # 02 · C — activité
    P.append(('02-activites', C(
        '02', 'ثلاث خطوات في صفحة',
        'النشاط يبرمج <b>واليوم يبان</b> قدّام الجميع.',
        'زيدي نشاط، حدّدي القسم واليوم، والصفحة تعرض واش مبرمج — بلا ورقة وبلا مكالمات.',
        'برمجي نشاط هذا الأسبوع',
        [('نشاط اليوم', '0'), ('الأقسام', '1')],
        [snap('activites', '01', 'النشاطات', 'فلتر «اليوم» يعرض غير برنامج اليوم.'),
         snap('presences', '02', 'بلاصة النشاط', 'التسجيل اليومي، والنشاط فوقو.')],
        [('بلا مكالمات', '', '0'), ('قنوات', '', '3'), ('أقسام', '', '1')], True)))

    # 03 · C — enfants
    P.append(('03-enfants', C(
        '03', 'كل شيء في ملف واحد',
        'ملف الطفل <b>ماشي ورقة</b> ضايعة.',
        'الاسم، القسم، الحساسية، والوثائق — كل حاجة في بطاقة وحدة، وفلاتر جاهزة للأعمار.',
        'افتحي ملفات الأطفال',
        [('ملف ناقص', '1'), ('حساسية', '1')],
        [snap('enfants', '01', 'ملفات الأطفال', 'الفلاتر: الأعمار، الملف الناقص، الحساسية.'),
         snap('communication', '02', 'ربط الولي والتذكيرات', 'كود QR دائم، والتحقّق قبل الصلاحية.')],
        [('QR دائم', '', '✓'), ('فلاتر', '', '4'), ('ملف ناقص', 'bad', '1')])))

    # 04 · A sombre — factures
    P.append(('04-factures', A(
        '04', True, 'قبل ما تعتمدي الشهر',
        'فاتورة قديمة؟ <b>التحذير يسبق</b> الاعتماد.',
        'فاتورة بدون مراجعة تعطيك تحذير — قبل ما تتحوّل لخطأ في الحساب.',
        'راجعي فواتير الشهر', 'factures',
        'فواتير متأخرة', 'DA 3 500', 'bad', 'فاتورة واحدة تحتاج مراجعة قبل الاعتماد.',
        'تنبيه قبل الاعتماد', '«1 فاتورة قديمة دون فترة مراجعة» — تحذير ظاهر.',
        [('مدفوع', 'DA 0,00', 'ok'), ('انتظار', 'DA 0,00', ''), ('متأخرة', '1', 'bad')],
        [('v04', '01', 'تحذير الفترة', 'فاتورة بلا مراجعة قبل الاعتماد.'),
         ('v07', '02', 'الرصيد', 'المدفوع والانتظار في نفس البطاقة.'),
         ('v09', '03', 'دفعات اليوم', 'كل ما صُرّح به، مسجّل.')],
        ('«1 فاتورة قديمة دون فترة مراجعة»', 'العبارة من شاشة الفواتير.'), True)))

    # 05 · B miroir — équipe
    P.append(('05-equipe', B(
        '05', 'equipe', 'ثلاث مساحات، فريق واحد',
        'الفريق، التسييقات، <b>والصلاحيات.</b>',
        'كل عضو في بلاصتو: شكون يخدم، شكون يسجّل، وشكون يشوف غير اللي يخصّو.',
        [('أعضاء', '0', ''), ('في الخدمة', '0', ''), ('صلاحيات', '3', 'nv')],
        [('v05', '01', 'الفريق', 'الأعضاء وعددهم في الخدمة.'),
         ('v05', '02', 'الصلاحيات', 'شكون يشوف واش، قبل الزيادة.'),
         ('v04', '03', 'التسييقات', 'مربية، إدارة، محاسبة.'),
         ('v09', '04', 'الدليل', 'كل دور موثّق من الأول.')],
        ('«0 عضو مسجّل · 0 في الخدمة»', 'الرقم مأخوذ من الشاشة مباشرة.'),
        'افتحي مساحة الفريق',
        ('ÉQUIPE', 'الصلاحيات <b>قبل</b> ما تزيدي عضو.',
         'الفريق، التسييقات، والصلاحيات — ثلاث مساحات.',
         [('أعضاء', '0'), ('في الخدمة', '0')],
         [('ثلاث', 'مساحات: الفريق، التسييقات، الصلاحيات'),
          ('الصلاحية', 'تتحدد قبل إضافة العضو'),
          ('الأدوار', 'مربية، إدارة، محاسبة')]), mirror=True)))

    # 06 · C — achats
    P.append(('06-achats', C(
        '06', 'المصاريف، بلا فوضى',
        'وين راحت <b>المصاريف؟</b> الأرقام تقول.',
        'كل شراء يتسجّل، وكل مبلغ يتحسب — حتى قبل ما يكمّل الشهر.',
        'سجّلي شراء اليوم',
        [('إجمالي', 'DA 0,00'), ('بلا مرجع', '0')],
        [snap('achats', '01', 'المشتريات والمصاريف', 'الإجمالي، المدفوع، والانتظار فوق.'),
         snap('factures', '02', 'مربوط بالفواتير', 'كل مبلغ مربوط بفاتورتو ومورّدو.')],
        [('فئات', '', '6'), ('مرجع', '', '100%'), ('بلا مرجع', 'bad', '0')])))

    # 07 · A clair — rapports
    P.append(('07-rapports', A(
        '07', False, 'تقرير الشهر في صفحة',
        'شهر كامل، <b>في رقم</b> وثلاثة بطاقات.',
        'الحضور، الفواتير المتأخرة، والأطفال النشطون — من نفس الشاشة.',
        'افتحي تقرير نوفمبر', 'rapports',
        'نسبة الحضور', '50%', 'ok', '2 تسجيلات · نوفمبر 2026.',
        'الحضور خلال الفترة', 'حاضرون وغيابات في عمود واحد، بلا حسابات.',
        [('حضور', '50%', 'ok'), ('تسجيلات', '2', ''), ('متأخرة', '1', 'bad')],
        [('v07', '01', 'مؤشر الفترة', 'نسبة الحضور والتسجيلات.'),
         ('v02', '02', 'تنبيه الفاتورة', 'مراجعة قبل الاعتماد.'),
         ('v03', '03', 'تصدير', 'CSV للوليّ أو للمحاسبة.')],
        ('«الحضور خلال الفترة» + «الفواتير المعلقة»', 'تقرير واحد، بلا Excel.'),
        True)))

    # 08 · C — communication
    P.append(('08-communication', C(
        '08', 'ثلاث طرق للوصول',
        'التواصل مع الأولياء <b>ماشي رسالة</b> واحدة لكل واحد.',
        'تذكيرات، QR، وإشعارات Push — كل طريق يخدم بلاصتو، والاختيار يبقى ليك.',
        'شوفي قنوات التواصل',
        [('متأخرات', '0'), ('صالحة', '0')],
        [snap('communication', '01', 'التذكيرات و QR', 'المستحقات توصل وحدها، والربط بكود.'),
         snap('accueil', '02', 'إشعارات Push', 'وصول، مغادرة، غياب — بلا مكالمة.')],
        [('قنوات', '', '3'), ('Push', '', 'ON'), ('QR', '', '✓')], True)))

    # 09 · B — guide
    P.append(('09-guide', B(
        '09', 'guide', 'أول مرة على Rawdha+',
        'أربع شاشات <b>وتبدا</b> الخدمة.',
        'الدليل يوريك وين تلقاي كل وحدة، بالترتيب — بلا ما تفتّشي في القوائم.',
        [('مراحل', '04', 'nv'), ('شاشات', '4', ''), ('دقايق', '3', '')],
        [('v09', '01', 'كيفية الاستخدام', 'مراحل رئيسية، بلا نوافذ زايدة.'),
         ('v05', '02', 'الفريق', 'الأدوار والصلاحيات من الأول.'),
         ('v07', '03', 'التقارير', 'من الشاشة للـCSV.'),
         ('v01', '04', 'الحضور', 'الصباح في دقيقة وحدة.')],
        ('«كيفية استخدام روضتي+» — مراحل رئيسية دون نوافذ إضافية.', 'هكذا يقدّم التطبيق الدليل.'),
        'افتحي الدليل',
        ('GUIDE', 'أربع شاشات، <b>بالترتيب</b>.', 'الأطفال، الحضور، الفواتير، التقارير.',
         [('خطوات', '8'), ('لغة', 'AR')],
         [('مراحل', 'رئيسية، بلا نوافذ إضافية'), ('ترتيب', 'من الأطفال للتقارير'),
          ('وقت', '3 دقايق تقريباً')]))))

    # 10 · A clair — accueil
    P.append(('10-accueil', A(
        '10', False, 'نظرة واحدة على الصباح',
        'قبل ما تحلّي <b>الباب،</b> الصورة واضحة.',
        'الحضور، الوجبات، والمتبقي للتسجيل، وإعداد الحضانة — كلهم في لوحة الاستقبال.',
        'افتحي لوحة الاستقبال', 'accueil',
        'إعداد الحضانة', '3/5', 'ok', 'خطوتين باقيين قبل ما تبدا الخدمة.',
        'لوحة الاستقبال', 'الحضور والوجبات والمتبقي، في الأول.',
        [('حضور', '0/1', ''), ('متبقي', '1', 'bad'), ('وجبات', '0', '')],
        [('v10', '01', 'لوحة الاستقبال', 'الحضور والوجبات والمتبقي في الأول.'),
         ('v02', '02', 'إعداد الحضانة', 'المعلومات والتنبيهات وأول قسم.'),
         ('v06', '03', 'روتين الصباح', 'خطوة وحدة، وبعدها القائمة كاملة.')],
        ('«معلومات الحضانة» و«إنشاء أول قسم»', 'الخطوات الجاهزة في لوحة الإعداد.'))))

    for name, h in P:
        H.joinpath(name + '.html').write_text(h)
    return len(P)


if __name__ == '__main__':
    print('built', build())
