import re

with open('frontend/src/pages/Wallet.js', 'r', encoding='utf-8') as f:
    content = f.read()

if '@tanstack/react-virtual' not in content:
    content = content.replace('import { useCallback, useEffect, useMemo, useState } from "react";',
                              'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useVirtualizer } from "@tanstack/react-virtual";')
    content = content.replace('import { useEffect, useMemo, useState } from "react";',
                              'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useVirtualizer } from "@tanstack/react-virtual";')

start_idx = content.find('groupedTransactions.map((group) => (')
if start_idx != -1:
    article_start = content.find('<article', start_idx)
    article_end = content.find('</article>', article_start) + len('</article>')
    
    article_jsx = content[article_start:article_end]
    article_jsx = article_jsx.replace('key={transaction.id}', '', 1)
    
    transaction_list_code = f"""
const TransactionRow = React.memo(function TransactionRow({{ transaction, isMobile, formatCurrency, statusTone }}) {{
  return (
    <>
      {{transaction.bucketLabel && (
        <div className="sv-wallet-group-header" style={{{{ marginTop: '12px', marginBottom: '12px' }}}}>{{transaction.bucketLabel}}</div>
      )}}
      {article_jsx}
    </>
  );
}}, (prev, next) => prev.transaction.id === next.transaction.id && prev.isMobile === next.isMobile);

function TransactionList({{ groupedTransactions, isMobile, formatCurrency, statusTone }}) {{
  const parentRef = useRef(null);
  
  const flattenedTransactions = useMemo(() => {{
    const flattened = [];
    groupedTransactions.forEach(group => {{
      group.items.forEach((item, index) => {{
        flattened.push({{
          ...item,
          bucketLabel: index === 0 ? group.label : null
        }});
      }});
    }});
    return flattened;
  }}, [groupedTransactions]);

  const virtualizer = useVirtualizer({{
    count: flattenedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // rough estimate; measureElement refines
    overscan: 10,
  }});

  return (
    <div ref={{parentRef}} style={{{{ overflowY: "auto", height: "600px", paddingRight: "8px" }}}}>
      <div style={{{{ height: virtualizer.getTotalSize(), position: "relative" }}}}>
        {{virtualizer.getVirtualItems().map((vi) => (
          <div
            key={{flattenedTransactions[vi.index].id}}
            ref={{virtualizer.measureElement}}
            data-index={{vi.index}}
            style={{{{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${{vi.start}}px)` }}}}
          >
            <TransactionRow transaction={{flattenedTransactions[vi.index]}} isMobile={{isMobile}} formatCurrency={{formatCurrency}} statusTone={{statusTone}} />
          </div>
        ))}}
      </div>
    </div>
  );
}}
"""
    
    content = content.replace('export default function Wallet() {', transaction_list_code + '\nexport default function Wallet() {')
    
    block_start = content.find('groupedTransactions.map((group) => (')
    depth = 0
    block_end = -1
    for i in range(block_start, len(content)):
        if content[i] == '(':
            depth += 1
        elif content[i] == ')':
            depth -= 1
            if depth == 0:
                block_end = i + 1
                break
                
    if block_end != -1:
        full_map_block = content[block_start:block_end]
        content = content.replace(full_map_block, '<TransactionList groupedTransactions={groupedTransactions} isMobile={isMobile} formatCurrency={formatCurrency} statusTone={statusTone} />')
    
        with open('frontend/src/pages/Wallet.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Wallet virtualization completed.')
    else:
        print('Could not find end of map block')
else:
    print('Could not find groupedTransactions.map')
