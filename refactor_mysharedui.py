import re

# 1. Update index.css
with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    index_css = f.read()

if 'my-shared.css' not in index_css:
    index_css += '\n@import "./styles/my-shared.css";\n'
    with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
        f.write(index_css)

# 2. Update mySharedUi.js
with open('frontend/src/pages/mySharedUi.js', 'r', encoding='utf-8') as f:
    my_shared_ui = f.read()

# For SummaryCard component:
my_shared_ui = my_shared_ui.replace('style={{ ...summaryCard, ...(compact ? summaryCardMobile : {}) }}', 'className={`sv-ms-summary-card ${compact ? "is-mobile" : ""}`}')
my_shared_ui = my_shared_ui.replace('style={{ ...summaryLabel, ...(compact ? summaryLabelMobile : {}) }}', 'className={`sv-ms-summary-label ${compact ? "is-mobile" : ""}`}')
my_shared_ui = re.sub(r'style=\{\{\s*\.\.\.summaryValue,\s*\.\.\.\(compact \? summaryValueMobile : \{\}\),\s*color:.*?\}\}', 'className={`sv-ms-summary-value ${compact ? "is-mobile" : ""}`}', my_shared_ui, flags=re.DOTALL)

# For FilterButton:
my_shared_ui = my_shared_ui.replace('style={{ ...filterButton, ...(compact ? filterButtonCompact : {}), background: active ? svInk : svPaperGlass, color: active ? svPaperSolid : svInk, border: active ? "none" : `1px solid ${svBorder}` }}', 'className={`sv-ms-filter-button ${compact ? "sv-ms-filter-button-compact" : ""}`}')
# wait, FilterButton has dynamic color/background based on `active`.
# If I use className, the dynamic background/color will be lost unless I add a style={{...}} or use specific classes.
# I will retain the dynamic inline style but use className for the base styles.
my_shared_ui = my_shared_ui.replace('style={{ ...filterButton, ...(compact ? filterButtonCompact : {}), background: active ? svInk : svPaperGlass, color: active ? svPaperSolid : svInk, border: active ? "none" : `1px solid ${svBorder}` }}', 'className={`sv-ms-filter-button ${compact ? "sv-ms-filter-button-compact" : ""}`} style={{ background: active ? svInk : svPaperGlass, color: active ? svPaperSolid : svInk, border: active ? "none" : `1px solid ${svBorder}` }}')

with open('frontend/src/pages/mySharedUi.js', 'w', encoding='utf-8') as f:
    f.write(my_shared_ui)

# 3. Update MyShared.js
with open('frontend/src/pages/MyShared.js', 'r', encoding='utf-8') as f:
    my_shared = f.read()

# Map object names to CSS classes
replacements = {
    'sectionHeader': 'sv-ms-section-header',
    'sectionTitle': 'sv-ms-section-title',
    'card': 'sv-ms-card',
    'factsRow': 'sv-ms-star-row', # wait factsRow is actually not mapped directly.
}

# The spec specifically mentioned: cardMobile, sectionHeader, starRow.
# In MyShared.js we have patterns like: style={{ ...sectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}
# We will replace them with: className={`sv-ms-section-header ${isMobile ? "is-mobile" : ""}`}

pairs = [
    ('sectionHeader', 'sectionHeaderMobile', 'sv-ms-section-header'),
    ('sectionTitle', 'sectionTitleMobile', 'sv-ms-section-title'),
    ('card', 'cardMobile', 'sv-ms-card'),
    ('joinedSectionHeader', 'sectionHeaderMobile', 'sv-ms-section-header'), # joinedSectionHeader is same as sectionHeader?
    ('joinedCard', 'joinedCardMobile', 'sv-ms-card'), # joinedCard is same as card?
]

for base, mobile, cls in pairs:
    # Match style={{ ...base, ...(isMobile ? mobile : {}) }}
    pattern1 = f'style={{{{ \.\.\.{base}, \.\.\.\(isMobile \? {mobile} : {{}}\) }}}}'
    repl1 = f'className={{`{cls} ${{isMobile ? "is-mobile" : ""}}`}}'
    my_shared = re.sub(pattern1, repl1, my_shared)
    
    # Also without spacing
    pattern2 = f'style={{{{ \.\.\.{base},\.\.\.\(isMobile\?{mobile}:{{}}\) }}}}'
    my_shared = re.sub(pattern2, repl1, my_shared)

# Hero is rendered in MyShared.js maybe?
pairs_hero = [
    ('hero', 'heroMobile', 'sv-ms-hero'),
    ('heroTitle', 'heroTitleMobile', 'sv-ms-hero-title'),
]
for base, mobile, cls in pairs_hero:
    pattern1 = f'style={{{{ \.\.\.{base}, \.\.\.\(isMobile \? {mobile} : {{}}\) }}}}'
    repl1 = f'className={{`{cls} ${{isMobile ? "is-mobile" : ""}}`}}'
    my_shared = re.sub(pattern1, repl1, my_shared)

with open('frontend/src/pages/MyShared.js', 'w', encoding='utf-8') as f:
    f.write(my_shared)

print("MyShared CSS refactor completed.")
