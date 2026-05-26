import re

filepath = r"c:\Users\ACER\mystartup\frontend\src\App.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# I will replace all instances of:
# element={
#   <PublicRoute>
#     <Landing />
#   </PublicRoute>
# }
# with ErrorBoundary wrappers. Since we have standard routes and Private/Public routes, we can just replace the element props:

def replacement(match):
    inner = match.group(1)
    if "<ErrorBoundary>" in inner:
        return match.group(0)
    return f"element={{\n              <ErrorBoundary>\n{inner}\n              </ErrorBoundary>\n            }}"

# Use regex to match element={ ... } multi-line.
# The routes are indented by spaces, so we should be careful.
# Actually, the simplest way is to find `<Route ... element={<Something />} />`

routes = [
    ("Landing", "<PublicRoute>\n                <Landing />\n              </PublicRoute>"),
    ("Login", "<PublicRoute>\n                <Login setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />\n              </PublicRoute>"),
    ("Signup", "<PublicRoute>\n                <Signup setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />\n              </PublicRoute>"),
    ("AboutPage", "<AboutPage />"),
    ("FaqPage", "<FaqPage />"),
    ("InviteLanding", "<InviteLanding />"),
    ("TermsPage", "<TermsPage />"),
    ("PrivacyPage", "<PrivacyPage />"),
    ("RefundPolicyPage", "<RefundPolicyPage />"),
    ("ShippingPolicyPage", "<ShippingPolicyPage />"),
    ("SupportPage", "<SupportPage />"),
    ("AccountDeletionPage", "<AccountDeletionPage />"),
    ("Home", "<PrivateRoute>\n                <Home />\n              </PrivateRoute>"),
    ("Dashboard", "<PrivateRoute>\n                <Navigate to=\"/home\" replace />\n              </PrivateRoute>"),
    ("Groups", "<PrivateRoute>\n                <Groups />\n              </PrivateRoute>"),
    ("NotificationsInbox", "<PrivateRoute>\n                <NotificationsInbox />\n              </PrivateRoute>"),
    ("ChatsInbox", "<PrivateRoute>\n                <ChatsInbox />\n              </PrivateRoute>"),
    ("CreateGroup", "<PrivateRoute>\n                <CreateGroup />\n              </PrivateRoute>"),
    ("MyShared", "<PrivateRoute>\n                <MyShared />\n              </PrivateRoute>"),
    ("Profile", "<PrivateRoute>\n                <Profile />\n              </PrivateRoute>"),
    ("Wallet", "<PrivateRoute>\n                <Wallet />\n              </PrivateRoute>"),
    ("ReferralPage", "<PrivateRoute>\n                <ReferralPage />\n              </PrivateRoute>"),
    ("GroupChat", "<PrivateRoute>\n                <GroupChat />\n              </PrivateRoute>"),
]

for name, inner in routes:
    if inner.startswith("<AboutPage") or inner.startswith("<FaqPage") or inner.startswith("<InviteLanding") or inner.startswith("<TermsPage") or inner.startswith("<PrivacyPage") or inner.startswith("<RefundPolicyPage") or inner.startswith("<ShippingPolicyPage") or inner.startswith("<SupportPage") or inner.startswith("<AccountDeletionPage"):
        # Single line elements
        content = content.replace(f"element={{{inner}}}", f"element={{<ErrorBoundary>{inner}</ErrorBoundary>}}")
    else:
        # Multi line elements
        # The spacing is exact
        target = f"element={{\n              {inner}\n            }}"
        replacement = f"element={{\n              <ErrorBoundary>\n                {inner.replace(chr(10), chr(10) + '  ')}\n              </ErrorBoundary>\n            }}"
        content = content.replace(target, replacement)

# Don't forget the catch-all
content = content.replace('element={<Navigate to="/" />}', 'element={<ErrorBoundary><Navigate to="/" /></ErrorBoundary>}')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
