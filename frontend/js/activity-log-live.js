(function () {

    "use strict";

    /* =========================================================
       FRIENDLY AUDIT METADATA
    ========================================================= */

    function formatMetadataText(
        metadata,
        log = {}
    ) {

        if (
            !metadata ||
            typeof metadata !== "object"
        ) {

            return "No additional details";
        }


        const entity =
            String(
                log.entityType ||
                log.entity_type ||
                ""
            ).toUpperCase();


        function labelFor(key) {

            if (
                entity === "DEPARTMENT"
            ) {

                const labels = {

                    name:
                        "Department Name",

                    code:
                        "Department Code",

                    headUserId:
                        "Department Head",

                    description:
                        "Description",

                    isActive:
                        "Status"

                };


                if (
                    labels[key]
                ) {

                    return labels[key];
                }
            }


            const labels = {

                assignedTo:
                    "Assigned Technician",

                technicianId:
                    "Technician",

                requesterId:
                    "Requester",

                departmentId:
                    "Department",

                categoryId:
                    "Category",

                ticketNumber:
                    "Ticket Number",

                oldStatus:
                    "Previous Status",

                newStatus:
                    "New Status",

                priority:
                    "Priority"

            };


            if (
                labels[key]
            ) {

                return labels[key];
            }


            return String(key)

                .replace(
                    /([a-z0-9])([A-Z])/g,
                    "$1 $2"
                )

                .replace(
                    /_/g,
                    " "
                )

                .replace(
                    /Id/g,
                    "ID"
                )

                .replace(
                    /\w/g,
                    char =>
                        char.toUpperCase()
                );
        }


        function valueFor(
            key,
            value
        ) {

            if (
                key === "isActive"
            ) {

                return value
                    ? "Active"
                    : "Inactive";
            }


            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                if (
                    /head|assign|technician/i.test(
                        key
                    )
                ) {

                    return "Unassigned";
                }


                return "Not set";
            }


            if (
                typeof value ===
                "boolean"
            ) {

                return value
                    ? "Yes"
                    : "No";
            }


            if (
                Array.isArray(value)
            ) {

                return value.length
                    ? value.join(", ")
                    : "None";
            }


            if (
                typeof value ===
                "object"
            ) {

                return Object.entries(value)
                    .map(
                        ([childKey, childValue]) =>
                            `${labelFor(childKey)}: ${
                                valueFor(
                                    childKey,
                                    childValue
                                )
                            }`
                    )
                    .join(" · ");
            }


            return String(value);
        }


        const hiddenKeys =
            new Set([
                "password",
                "passwordHash",
                "token",
                "secret",
                "session",
                "sessionId"
            ]);


        const rows =
            Object.entries(metadata)
                .filter(
                    ([key]) =>
                        !hiddenKeys.has(
                            key
                        )
                )
                .map(
                    ([key, value]) =>
                        `${labelFor(key)}: ${
                            valueFor(
                                key,
                                value
                            )
                        }`
                );


        return rows.length
            ? rows.join("\n")
            : "No additional details";
    }




    /* =========================================================
       STATE
    ========================================================= */

    let liveLogs =
        [];

    let currentPage =
        1;

    const pageSize =
        10;

    let toastTimer =
        null;


    /* =========================================================
       ELEMENT
    ========================================================= */

    function get(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    /* =========================================================
       API
    ========================================================= */

    async function api(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "include",

                    ...options
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch (
            error
        ) {

            data = {};
        }


        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "/login.html"
            );


            throw new Error(
                "Authentication required."
            );
        }


        if (
            response.status ===
            403
        ) {

            window.location.replace(
                "/dashboard.html"
            );


            throw new Error(
                "Administrator access required."
            );
        }


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                "Unable to load audit logs."
            );
        }


        return data;
    }


    /* =========================================================
       ESCAPE
    ========================================================= */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    /* =========================================================
       LABEL
    ========================================================= */

    function label(
        value
    ) {

        return String(
            value ||
            ""
        )
            .replaceAll(
                "_",
                " "
            )
            .replaceAll(
                "-",
                " "
            )
            .toLowerCase()
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    /* =========================================================
       INITIALS
    ========================================================= */

    function initials(
        name
    ) {

        return String(
            name ||
            "RS"
        )
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
                part =>
                    part[0]
            )
            .join("")
            .toUpperCase();
    }


    /* =========================================================
       NORMALIZE
    ========================================================= */

    function normalizeLog(
        row
    ) {

        const entity =
            row.entityType
                ? `${
                    row.entityType
                }${
                    row.entityId
                        ? ` #${row.entityId}`
                        : ""
                }`
                : "SYSTEM";


        return {

            id:
                row.id,

            actor:
                row.actor ||
                "ResolveDesk System",

            actorEmail:
                row.actorEmail ||
                "",

            role:
                row.role ||
                "SYSTEM",

            type:
                String(
                    row.type ||
                    "system"
                ).toLowerCase(),

            severity:
                String(
                    row.severity ||
                    "INFO"
                ).toLowerCase(),

            action:
                row.action ||
                "SYSTEM_EVENT",

            description:
                getDescription(
                    row
                ),

            entity,

            entityType:
                row.entityType,

            entityId:
                row.entityId,

            ip:
                row.ip ||
                "—",

            userAgent:
                row.userAgent ||
                "—",

            metadata:
                row.metadata ||
                {},

            time:
                row.createdAt,

            createdAt:
                row.createdAt

        };
    }


    /* =========================================================
       DESCRIPTION
    ========================================================= */

    function getDescription(
        row
    ) {

        const metadata =
            row.metadata ||
            {};


        if (
            metadata.description
        ) {

            return String(
                metadata.description
            );
        }


        if (
            metadata.message
        ) {

            return String(
                metadata.message
            );
        }


        const action =
            String(
                row.action ||
                ""
            );


        const entity =
            row.entityType
                ? `${
                    label(
                        row.entityType
                    )
                }${
                    row.entityId
                        ? ` #${row.entityId}`
                        : ""
                }`
                : "system";


        return `${
            label(
                action
            )
        } recorded for ${entity}.`;
    }


    /* =========================================================
       LOAD USER
    ========================================================= */

    async function loadUser() {

        const data =
            await api(
                "/api/auth/me"
            );


        if (
            !data.loggedIn ||
            !data.user
        ) {

            window.location.replace(
                "/login.html"
            );

            return;
        }


        const user =
            data.user;


        if (
            user.role !==
            "ADMIN"
        ) {

            window.location.replace(
                "/dashboard.html"
            );

            return;
        }


        const name =
            user.fullName ||
            user.name ||
            user.email ||
            "Administrator";


        const profileName =
            document.querySelector(
                ".profile-copy strong"
            );


        const profileRole =
            document.querySelector(
                ".profile-copy span"
            );


        const avatar =
            document.querySelector(
                ".profile .avatar"
            );


        if (
            profileName
        ) {

            profileName.textContent =
                name;
        }


        if (
            profileRole
        ) {

            profileRole.textContent =
                "Administrator";
        }


        if (
            avatar
        ) {

            avatar.textContent =
                initials(
                    name
                );
        }
    }


    /* =========================================================
       LOAD LOGS
    ========================================================= */

    async function loadLogs() {

        const data =
            await api(
                "/api/audit-logs?limit=5000"
            );


        const rows =
            Array.isArray(
                data.logs
            )
                ? data.logs
                : [];


        liveLogs =
            rows.map(
                normalizeLog
            );


        buildActorFilter();

        updateStats();

        renderLogs();


        console.log(
            "✅ ResolveDesk audit logs:",
            liveLogs
        );
    }


    /* =========================================================
       ACTOR FILTER
    ========================================================= */

    function buildActorFilter() {

        const select =
            get(
                "actorFilter"
            );


        if (
            !select
        ) {

            return;
        }


        const selected =
            select.value;


        const actors =
            [
                ...new Set(
                    liveLogs
                        .map(
                            log =>
                                log.actor
                        )
                        .filter(Boolean)
                )
            ]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a.localeCompare(
                            b
                        )
                );


        select.innerHTML =
            `
                <option value="">
                    All Actors
                </option>
            `;


        actors.forEach(
            actor => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    actor;


                option.textContent =
                    actor;


                select.appendChild(
                    option
                );
            }
        );


        if (
            [
                ...select.options
            ].some(
                option =>
                    option.value ===
                    selected
            )
        ) {

            select.value =
                selected;
        }
    }


    /* =========================================================
       FILTERS
    ========================================================= */

    function getFilteredLogs() {

        const search =
            String(
                get(
                    "searchInput"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const type =
            String(
                get(
                    "typeFilter"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const severity =
            String(
                get(
                    "severityFilter"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const actor =
            String(
                get(
                    "actorFilter"
                )?.value ||
                ""
            );


        return liveLogs.filter(
            log => {

                const searchable =
                    [
                        log.id,
                        log.actor,
                        log.actorEmail,
                        log.role,
                        log.action,
                        log.description,
                        log.entity,
                        log.entityType,
                        log.entityId,
                        log.ip,
                        log.userAgent,
                        JSON.stringify(
                            log.metadata ||
                            {}
                        )
                    ]
                        .join(
                            " "
                        )
                        .toLowerCase();


                return (

                    (
                        !search ||
                        searchable.includes(
                            search
                        )
                    ) &&

                    (
                        !type ||
                        log.type ===
                            type
                    ) &&

                    (
                        !severity ||
                        log.severity ===
                            severity
                    ) &&

                    (
                        !actor ||
                        log.actor ===
                            actor
                    )

                );
            }
        );
    }


    /* =========================================================
       FORMAT TIME
    ========================================================= */

    function formatTime(
        value
    ) {

        if (
            !value
        ) {

            return "—";
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                value
            );
        }


        return date
            .toLocaleString(
                "en-MY",
                {

                    dateStyle:
                        "medium",

                    timeStyle:
                        "medium"

                }
            );
    }


    /* =========================================================
       TYPE ICON
    ========================================================= */

    function typeIcon(
        type
    ) {

        switch (
            type
        ) {

            case "auth":
                return "◆";

            case "ticket":
                return "◫";

            case "user":
                return "♙";

            case "sla":
                return "⏱";

            default:
                return "◷";
        }
    }


    /* =========================================================
       RENDER TABLE
    ========================================================= */

    function renderLogs() {

        const rows =
            get(
                "auditRows"
            );


        const empty =
            get(
                "emptyState"
            );


        if (
            !rows
        ) {

            return;
        }


        const filtered =
            getFilteredLogs();


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    filtered.length /
                    pageSize
                )
            );


        if (
            currentPage >
            totalPages
        ) {

            currentPage =
                totalPages;
        }


        const start =
            (
                currentPage -
                1
            ) *
            pageSize;


        const pageData =
            filtered.slice(
                start,
                start +
                pageSize
            );


        const count =
            get(
                "resultCount"
            );


        if (
            count
        ) {

            count.textContent =
                `${
                    filtered.length
                } event${
                    filtered.length === 1
                        ? ""
                        : "s"
                }`;
        }


        if (
            pageData.length ===
            0
        ) {

            rows.innerHTML =
                "";


            if (
                empty
            ) {

                empty.style.display =
                    "block";
            }


            updatePagination(
                filtered.length,
                totalPages,
                start
            );


            return;
        }


        if (
            empty
        ) {

            empty.style.display =
                "none";
        }


        rows.innerHTML =
            pageData
                .map(
                    log => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    formatTime(
                                        log.createdAt
                                    )
                                )}
                            </td>


                            <td>

                                <div class="actor">

                                    <div class="actor-avatar">
                                        ${escapeHtml(
                                            initials(
                                                log.actor
                                            )
                                        )}
                                    </div>

                                    <div>

                                        <strong>
                                            ${escapeHtml(
                                                log.actor
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHtml(
                                                label(
                                                    log.role
                                                )
                                            )}
                                        </span>

                                    </div>

                                </div>

                            </td>


                            <td>

                                <span
                                    class="
                                        event-type
                                        ${escapeHtml(
                                            log.type
                                        )}
                                    "
                                >
                                    ${escapeHtml(
                                        typeIcon(
                                            log.type
                                        )
                                    )}

                                    ${escapeHtml(
                                        label(
                                            log.type
                                        )
                                    )}
                                </span>

                            </td>


                            <td>

                                <div class="action-copy">

                                    <strong>
                                        ${escapeHtml(
                                            label(
                                                log.action
                                            )
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            log.description
                                        )}
                                    </span>

                                </div>

                            </td>


                            <td>
                                ${escapeHtml(
                                    log.entity
                                )}
                            </td>


                            <td>

                                <span
                                    class="
                                        severity
                                        ${escapeHtml(
                                            log.severity
                                        )}
                                    "
                                >
                                    ${escapeHtml(
                                        log.severity
                                            .toUpperCase()
                                    )}
                                </span>

                            </td>


                            <td>
                                ${escapeHtml(
                                    log.ip
                                )}
                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="
                                        detail-button
                                        live-view-audit
                                    "
                                    data-audit-id="${escapeHtml(
                                        log.id
                                    )}"
                                >
                                    View →
                                </button>

                            </td>

                        </tr>
                    `
                )
                .join(
                    ""
                );


        updatePagination(
            filtered.length,
            totalPages,
            start
        );
    }


    /* =========================================================
       PAGINATION
    ========================================================= */

    function updatePagination(
        totalItems,
        totalPages,
        start
    ) {

        const pagination =
            get(
                "pagination"
            );


        const info =
            get(
                "paginationInfo"
            );


        const previous =
            get(
                "previousPage"
            );


        const next =
            get(
                "nextPage"
            );


        const current =
            get(
                "currentPageButton"
            );


        if (
            pagination
        ) {

            pagination.style.display =
                "flex";
        }


        if (
            info
        ) {

            if (
                totalItems ===
                0
            ) {

                info.textContent =
                    "Showing 0 events";

            } else {

                const end =
                    Math.min(
                        start +
                        pageSize,
                        totalItems
                    );


                info.textContent =
                    `Showing ${
                        start + 1
                    }–${end} of ${
                        totalItems
                    } events`;
            }
        }


        if (
            current
        ) {

            current.textContent =
                currentPage;
        }


        if (
            previous
        ) {

            previous.disabled =
                currentPage <=
                1;
        }


        if (
            next
        ) {

            next.disabled =
                currentPage >=
                totalPages;
        }
    }


    /* =========================================================
       STATS
    ========================================================= */

    function updateStats() {

        const today =
            new Date();


        const todayCount =
            liveLogs.filter(
                log => {

                    if (
                        !log.createdAt
                    ) {

                        return false;
                    }


                    const date =
                        new Date(
                            log.createdAt
                        );


                    return (

                        date.getFullYear() ===
                            today.getFullYear() &&

                        date.getMonth() ===
                            today.getMonth() &&

                        date.getDate() ===
                            today.getDate()

                    );
                }
            ).length;


        const ticketCount =
            liveLogs.filter(
                log =>
                    log.type ===
                    "ticket"
            ).length;


        const userCount =
            liveLogs.filter(
                log =>
                    log.type ===
                    "user"
            ).length;


        const securityCount =
            liveLogs.filter(
                log =>
                    log.type ===
                        "auth" ||
                    log.severity ===
                        "critical"
            ).length;


        setText(
            "todayCount",
            todayCount
        );


        setText(
            "ticketCount",
            ticketCount
        );


        setText(
            "userCount",
            userCount
        );


        setText(
            "securityCount",
            securityCount
        );
    }


    function setText(
        id,
        value
    ) {

        const element =
            get(
                id
            );


        if (
            element
        ) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       DETAIL
    ========================================================= */

    function viewAudit(
        id
    ) {

        const log =
            liveLogs.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        id
                    )
            );


        if (
            !log
        ) {

            return;
        }


        const content =
            get(
                "detailContent"
            );


        const modal =
            get(
                "detailModal"
            );


        if (
            !content ||
            !modal
        ) {

            return;
        }


        content.innerHTML = `

            <div class="detail-event">

                <div class="detail-icon">
                    ${escapeHtml(
                        typeIcon(
                            log.type
                        )
                    )}
                </div>

                <div>

                    <h3>
                        ${escapeHtml(
                            label(
                                log.action
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            log.description
                        )}
                    </p>

                </div>

            </div>


            <div class="detail-grid">

                <div class="detail-item">
                    <small>
                        Audit ID
                    </small>
                    <strong>
                        #${escapeHtml(
                            log.id
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Actor
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.actor
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Role
                    </small>
                    <strong>
                        ${escapeHtml(
                            label(
                                log.role
                            )
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Event Type
                    </small>
                    <strong>
                        ${escapeHtml(
                            label(
                                log.type
                            )
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Severity
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.severity
                                .toUpperCase()
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Entity
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.entity
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        IP Address
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.ip
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Time
                    </small>
                    <strong>
                        ${escapeHtml(
                            formatTime(
                                log.createdAt
                            )
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        Email
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.actorEmail ||
                            "—"
                        )}
                    </strong>
                </div>


                <div class="detail-item">
                    <small>
                        User Agent
                    </small>
                    <strong>
                        ${escapeHtml(
                            log.userAgent
                        )}
                    </strong>
                </div>

            </div>


            <div class="change-box">

                <h4>
                    Event Metadata
                </h4>

                <div class="change-row">

                    <span>
                        Metadata
                    </span>

                    <strong>
                        <pre style="
                            white-space:pre-wrap;
                            margin:0;
                            font:inherit;
                        ">${escapeHtml(
                            formatMetadataText(
                                log.metadata,
                                log
                            )
                        )}</pre>
                    </strong>

                </div>

            </div>
        `;


        modal.classList.add(
            "open"
        );


        modal.style.display =
            "flex";


        document.body.style.overflow =
            "hidden";
    }


    function closeDetail() {

        const modal =
            get(
                "detailModal"
            );


        if (
            !modal
        ) {

            return;
        }


        modal.classList.remove(
            "open"
        );


        modal.style.display =
            "none";


        document.body.style.overflow =
            "";
    }


    /* =========================================================
       CSV
    ========================================================= */

    function exportCsv() {

        const logs =
            getFilteredLogs();


        const rows = [

            [
                "ID",
                "Time",
                "Actor",
                "Role",
                "Type",
                "Severity",
                "Action",
                "Entity Type",
                "Entity ID",
                "IP Address",
                "Metadata"
            ],

            ...logs.map(
                log => [

                    log.id,

                    formatTime(
                        log.createdAt
                    ),

                    log.actor,

                    log.role,

                    log.type,

                    log.severity,

                    log.action,

                    log.entityType ||
                        "",

                    log.entityId ||
                        "",

                    log.ip,

                    formatMetadataText(
                        log.metadata,
                        log
                    ).replace(
                        /\n/g,
                        " | "
                    )

                ]
            )

        ];


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                csvCell
                            )
                            .join(
                                ","
                            )
                )
                .join(
                    "\n"
                );


        const blob =
            new Blob(
                [
                    "\uFEFF",
                    csv
                ],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            `resolvedesk-audit-log-${
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    )
            }.csv`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        showToast(
            "Audit log exported."
        );
    }


    function csvCell(
        value
    ) {

        return `"${String(
            value ??
            ""
        ).replaceAll(
            '"',
            '""'
        )}"`;
    }


    /* =========================================================
       FILTER EVENTS

       Capture phase blocks old demo handlers.
    ========================================================= */

    function setupFilters() {

        [
            "searchInput",
            "typeFilter",
            "severityFilter",
            "actorFilter"
        ]
            .forEach(
                id => {

                    const element =
                        get(
                            id
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    const eventName =
                        id ===
                        "searchInput"
                            ? "input"
                            : "change";


                    element.addEventListener(
                        eventName,
                        event => {

                            event.stopImmediatePropagation();


                            currentPage =
                                1;


                            renderLogs();

                        },
                        true
                    );
                }
            );


        const topSearch =
            get(
                "topSearch"
            );


        if (
            topSearch
        ) {

            topSearch.addEventListener(
                "input",
                event => {

                    event.stopImmediatePropagation();


                    const input =
                        get(
                            "searchInput"
                        );


                    if (
                        input
                    ) {

                        input.value =
                            topSearch.value;
                    }


                    currentPage =
                        1;


                    renderLogs();

                },
                true
            );
        }


        get(
            "resetFilters"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                [
                    "searchInput",
                    "topSearch",
                    "typeFilter",
                    "severityFilter",
                    "actorFilter"
                ]
                    .forEach(
                        id => {

                            const element =
                                get(
                                    id
                                );


                            if (
                                element
                            ) {

                                element.value =
                                    "";
                            }
                        }
                    );


                currentPage =
                    1;


                renderLogs();

            },
            true
        );
    }


    /* =========================================================
       PAGE EVENTS
    ========================================================= */

    function setupPagination() {

        get(
            "previousPage"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                if (
                    currentPage >
                    1
                ) {

                    currentPage--;


                    renderLogs();
                }

            },
            true
        );


        get(
            "nextPage"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            getFilteredLogs()
                                .length /
                            pageSize
                        )
                    );


                if (
                    currentPage <
                    totalPages
                ) {

                    currentPage++;


                    renderLogs();
                }

            },
            true
        );
    }


    /* =========================================================
       CLICK EVENTS
    ========================================================= */

    function setupClicks() {

        document.addEventListener(
            "click",
            event => {

                const detailButton =
                    event.target.closest(
                        ".live-view-audit"
                    );


                if (
                    detailButton
                ) {

                    event.preventDefault();


                    viewAudit(
                        detailButton.dataset
                            .auditId
                    );


                    return;
                }


                const modal =
                    get(
                        "detailModal"
                    );


                if (
                    modal &&
                    event.target ===
                        modal
                ) {

                    closeDetail();
                }
            }
        );


        get(
            "closeDetailModal"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                closeDetail();

            },
            true
        );


        get(
            "exportButton"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                exportCsv();

            },
            true
        );
    }


    /* =========================================================
       TOAST
    ========================================================= */

    function showToast(
        message
    ) {

        const toast =
            get(
                "toast"
            );


        if (
            !toast
        ) {

            console.log(
                message
            );

            return;
        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                2400
            );
    }


    /* =========================================================
       INIT
    ========================================================= */

    async function initialize() {

        setupFilters();

        setupPagination();

        setupClicks();


        try {

            await loadUser();

            await loadLogs();

        } catch (
            error
        ) {

            console.error(
                "❌ Activity log:",
                error
            );


            showToast(
                error.message
            );
        }
    }


    initialize();

})();