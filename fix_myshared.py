import os

filepath = r"c:\Users\ACER\mystartup\frontend\src\pages\MyShared.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Remove incorrectly placed hasMoreGroups
bad_has_more_groups = """          {hasMoreGroups && (
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
              <button
                style={{ ...secondaryButton, padding: "10px 24px" }}
                onClick={() => setPage(page + 1)}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}"""
content = content.replace(bad_has_more_groups, "")

# Remove incorrectly placed hasMoreGroups (second version)
bad_has_more_groups_2 = """          {hasMoreGroups && (
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
              <button
                style={{ ...secondaryButton, padding: "10px 24px" }}
                onClick={() => setPage(page + 1)}
              >
                Load More
              </button>
            </div>
          )}"""
content = content.replace(bad_has_more_groups_2, "")

# Insert hasMoreGroups at the correct location
# The correct location is right after:
#           );
#         })
#       )}
#
#       <div style={{ ...joinedSectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}>
target = """          );
        })
      )}

      <div style={{ ...joinedSectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}>"""

correct_has_more_groups = """          );
        })
      )}
      
      {hasMoreGroups && (
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
          <button
            style={{ ...secondaryButton, padding: "10px 24px" }}
            onClick={() => setPage(page + 1)}
          >
            Load More
          </button>
        </div>
      )}

      <div style={{ ...joinedSectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}>"""

content = content.replace(target, correct_has_more_groups)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
