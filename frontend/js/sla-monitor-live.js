(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let liveTickets = [];

    let currentUser = null;

    let refreshTimer = null;

    let clockTimer = null;

    let toastTimer = null;


    const SLA_DEFAULTS = {

        CRITICAL: {
            response: 15,
            resolution: 60
        },

        HIGH: {
            response: 30,
            resolution: 240
        },

        MEDIUM: {
            response: 120,
            resolution: 480
        },

        LOW: {
            response: 240,
            resolution: 1440
        }

    };


    /* =========================================================
       HELPERS
    ========================================================= */

    function get(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    function firstValue(
        object,
        keys,
        fallback = null
    ) {

        for (
            const key of keys
        ) {

            if (
                object?.[key] !==
                    undefined &&
                object?.[key] !==
                    null
            ) {

                return object[key];
            }
        }


        return fallback;
    }


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


    function label(
        value
    ) {

        return String(
            value || ""
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


    function normalizeStatus(
        value
    ) {

        return String(
            value || "OPEN"
        )
            .trim()
            .toUpperCase()
            .replaceAll(
                "-",
                "_"
            )
            .replaceAll(
                " ",
                "_"
            );
    }


    function normalizePriority(
        value
    ) {

        return String(
            value || "MEDIUM"
        )
            .trim()
            .toUpperCase();
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

                    ...options,

                    headers: {

                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers ||
                            {})

                    }
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch (error) {

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
            !response.ok
        ) {

            throw new Error(
                data.message ||
                "Request failed."
            );
        }


        return data;
    }


    /* =========================================================
       CURRENT USER
    ========================================================= */

    async function loadCurrentUser() {

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


        currentUser =
            data.user;


        const name =
            currentUser.fullName ||
            currentUser.name ||
            "ResolveDesk User";


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


        if (profileName) {

            profileName.textContent =
                name;
        }


        if (profileRole) {

            profileRole.textContent =
                label(
                    currentUser.role
                );
        }


        if (avatar) {

            avatar.textContent =
                String(name)
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(
                        word =>
                            word[0]
                    )
                    .join("")
                    .toUpperCase();
        }
    }


    /* =========================================================
       NORMALIZE DATABASE TICKET
    ========================================================= */

    function normalizeTicket(
        row
    ) {

        const priority =
            normalizePriority(
                firstValue(
                    row,
                    [
                        "priority"
                    ],
                    "MEDIUM"
                )
            );


        const defaultPolicy =
            SLA_DEFAULTS[
                priority
            ] ||
            SLA_DEFAULTS.MEDIUM;


        return {

            id:
                firstValue(
                    row,
                    [
                        "id"
                    ]
                ),

            ticketNumber:
                firstValue(
                    row,
                    [
                        "ticketNumber",
                        "ticket_number"
                    ],
                    "—"
                ),

            subject:
                firstValue(
                    row,
                    [
                        "subject"
                    ],
                    "Untitled Ticket"
                ),

            requester:
                firstValue(
                    row,
                    [
                        "requesterName",
                        "requester_name",
                        "requester"
                    ],
                    "Unknown"
                ),

            department:
                firstValue(
                    row,
                    [
                        "departmentName",
                        "department_name",
                        "department"
                    ],
                    "—"
                ),

            category:
                firstValue(
                    row,
                    [
                        "categoryName",
                        "category_name",
                        "category"
                    ],
                    "—"
                ),

            technician:
                firstValue(
                    row,
                    [
                        "assigneeName",
                        "assignee_name",
                        "technicianName",
                        "technician_name"
                    ],
                    "Unassigned"
                ) ||
                "Unassigned",

            priority,

            status:
                normalizeStatus(
                    firstValue(
                        row,
                        [
                            "status"
                        ],
                        "OPEN"
                    )
                ),

            createdAt:
                firstValue(
                    row,
                    [
                        "createdAt",
                        "created_at"
                    ]
                ),

            updatedAt:
                firstValue(
                    row,
                    [
                        "updatedAt",
                        "updated_at"
                    ]
                ),

            firstResponseDueAt:
                firstValue(
                    row,
                    [
                        "firstResponseDueAt",
                        "first_response_due_at"
                    ]
                ),

            resolutionDueAt:
                firstValue(
                    row,
                    [
                        "resolutionDueAt",
                        "resolution_due_at"
                    ]
                ),

            firstResponseAt:
                firstValue(
                    row,
                    [
                        "firstResponseAt",
                        "first_response_at"
                    ]
                ),

            resolvedAt:
                firstValue(
                    row,
                    [
                        "resolvedAt",
                        "resolved_at"
                    ]
                ),

            closedAt:
                firstValue(
                    row,
                    [
                        "closedAt",
                        "closed_at"
                    ]
                ),

            slaBreached:
                Boolean(
                    firstValue(
                        row,
                        [
                            "slaBreached",
                            "sla_breached"
                        ],
                        false
                    )
                ),

            resolutionMinutes:
                Number(
                    firstValue(
                        row,
                        [
                            "resolutionMinutes",
                            "resolution_minutes"
                        ],
                        defaultPolicy.resolution
                    )
                ),

            responseMinutes:
                Number(
                    firstValue(
                        row,
                        [
                            "responseMinutes",
                            "response_minutes"
                        ],
                        defaultPolicy.response
                    )
                )

        };
    }


    /* =========================================================
       LOAD REAL TICKETS
    ========================================================= */

    async function loadTickets() {

        const data =
            await api(
                "/api/tickets"
            );


        const rows =
            Array.isArray(
                data
            )
                ? data
                : (
                    data.tickets ||
                    data.data ||
                    []
                );


        liveTickets =
            rows.map(
                normalizeTicket
            );


        console.log(
            "✅ SLA tickets:",
            liveTickets
        );
    }


    /* =========================================================
       SLA STATE
    ========================================================= */

    function isActive(
        ticket
    ) {

        return ![
            "RESOLVED",
            "CLOSED"
        ].includes(
            ticket.status
        );
    }


    function getRemainingMs(
        ticket
    ) {

        if (
            !ticket.resolutionDueAt
        ) {

            return null;
        }


        const due =
            new Date(
                ticket.resolutionDueAt
            );


        if (
            Number.isNaN(
                due.getTime()
            )
        ) {

            return null;
        }


        return (
            due.getTime() -
            Date.now()
        );
    }


    function getCondition(
        ticket
    ) {

        const remaining =
            getRemainingMs(
                ticket
            );


        if (
            ticket.slaBreached
        ) {

            return "breached";
        }


        if (
            isActive(
                ticket
            ) &&
            remaining !== null &&
            remaining <= 0
        ) {

            return "breached";
        }


        if (
            isActive(
                ticket
            ) &&
            remaining !== null &&
            remaining <=
                60 *
                60 *
                1000
        ) {

            return "risk";
        }


        return "healthy";
    }


    /* =========================================================
       FILTER
    ========================================================= */

    function getFilteredTickets() {

        const priorityValue =
            String(
                get(
                    "priorityFilter"
                )?.value ||
                ""
            )
                .trim()
                .toUpperCase();


        const rawCondition =
            String(
                get(
                    "riskFilter"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const search =
            String(
                get(
                    "topSearch"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        let conditionValue =
            "";


        if (
            rawCondition.includes(
                "breach"
            )
        ) {

            conditionValue =
                "breached";

        } else if (
            rawCondition.includes(
                "risk"
            )
        ) {

            conditionValue =
                "risk";

        } else if (
            rawCondition.includes(
                "safe"
            ) ||
            rawCondition.includes(
                "health"
            )
        ) {

            conditionValue =
                "healthy";
        }


        return liveTickets
            .filter(
                ticket =>
                    isActive(
                        ticket
                    ) &&
                    ticket.resolutionDueAt
            )
            .filter(
                ticket => {

                    const matchesPriority =
                        !priorityValue ||
                        ticket.priority ===
                            priorityValue;


                    const matchesCondition =
                        !conditionValue ||
                        getCondition(
                            ticket
                        ) ===
                            conditionValue;


                    const text =
                        [
                            ticket.ticketNumber,
                            ticket.subject,
                            ticket.requester,
                            ticket.department,
                            ticket.category,
                            ticket.technician
                        ]
                            .join(
                                " "
                            )
                            .toLowerCase();


                    const matchesSearch =
                        !search ||
                        text.includes(
                            search
                        );


                    return (
                        matchesPriority &&
                        matchesCondition &&
                        matchesSearch
                    );
                }
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    const first =
                        getRemainingMs(
                            a
                        ) ??
                        Infinity;


                    const second =
                        getRemainingMs(
                            b
                        ) ??
                        Infinity;


                    return (
                        first -
                        second
                    );
                }
            );
    }


    /* =========================================================
       COUNTDOWN
    ========================================================= */

    function formatDuration(
        milliseconds
    ) {

        if (
            milliseconds ===
            null ||
            milliseconds ===
            undefined
        ) {

            return "—";
        }


        const breached =
            milliseconds <
            0;


        let seconds =
            Math.floor(
                Math.abs(
                    milliseconds
                ) /
                1000
            );


        const days =
            Math.floor(
                seconds /
                86400
            );


        seconds %=
            86400;


        const hours =
            Math.floor(
                seconds /
                3600
            );


        seconds %=
            3600;


        const minutes =
            Math.floor(
                seconds /
                60
            );


        seconds %=
            60;


        let text;


        if (
            days >
            0
        ) {

            text =
                `${days}d ${hours}h ${minutes}m`;

        } else {

            text =
                [
                    hours,
                    minutes,
                    seconds
                ]
                    .map(
                        value =>
                            String(
                                value
                            ).padStart(
                                2,
                                "0"
                            )
                    )
                    .join(":");
        }


        return breached
            ? `+${text}`
            : text;
    }


    /* =========================================================
       SLA PROGRESS
    ========================================================= */

    function getProgress(
        ticket
    ) {

        const remaining =
            getRemainingMs(
                ticket
            );


        if (
            remaining ===
            null
        ) {

            return 0;
        }


        if (
            remaining <= 0
        ) {

            return 100;
        }


        const totalMs =
            Math.max(
                1,
                ticket.resolutionMinutes *
                60 *
                1000
            );


        const used =
            totalMs -
            remaining;


        return Math.max(
            4,
            Math.min(
                100,
                used /
                totalMs *
                100
            )
        );
    }


    /* =========================================================
       RENDER RISK LIST
    ========================================================= */

    function renderRiskTickets() {

        const list =
            get(
                "riskList"
            );


        if (!list) {
            return;
        }


        const filtered =
            getFilteredTickets();


        if (
            filtered.length ===
            0
        ) {

            list.innerHTML = `
                <div style="
                    padding:28px 18px;
                    text-align:center;
                    color:#716579;
                    font-size:9px;
                ">
                    No SLA tickets match the current filters.
                </div>
            `;


            return;
        }


        list.innerHTML =
            filtered
                .map(
                    ticket => {

                        const condition =
                            getCondition(
                                ticket
                            );


                        const remaining =
                            getRemainingMs(
                                ticket
                            );


                        const progress =
                            getProgress(
                                ticket
                            );


                        return `
                            <article
                                class="risk-ticket"
                                data-ticket-id="${escapeHtml(
                                    ticket.id
                                )}"
                            >

                                <div class="risk-top">

                                    <div>

                                        <span class="risk-id">
                                            ${escapeHtml(
                                                ticket.ticketNumber
                                            )}
                                        </span>

                                        <strong>
                                            ${escapeHtml(
                                                ticket.subject
                                            )}
                                        </strong>

                                        <p>
                                            ${escapeHtml(
                                                ticket.department
                                            )}
                                            ·
                                            ${escapeHtml(
                                                ticket.technician
                                            )}
                                        </p>

                                    </div>


                                    <div
                                        class="sla ${escapeHtml(
                                            condition
                                        )}"
                                        data-live-sla-id="${escapeHtml(
                                            ticket.id
                                        )}"
                                    >
                                        ${escapeHtml(
                                            formatDuration(
                                                remaining
                                            )
                                        )}
                                    </div>

                                </div>


                                <div class="progress">

                                    <span
                                        style="
                                            width:${progress}%;
                                        "
                                    ></span>

                                </div>


                                <div class="risk-footer">

                                    <div class="risk-meta">

                                        <span
                                            class="priority ${escapeHtml(
                                                ticket.priority
                                                    .toLowerCase()
                                            )}"
                                        >
                                            ${escapeHtml(
                                                ticket.priority
                                            )}
                                        </span>

                                        &nbsp;

                                        ${escapeHtml(
                                            label(
                                                condition
                                            )
                                        )}

                                    </div>


                                    <button
                                        class="open-ticket live-open-ticket"
                                        type="button"
                                        data-ticket-id="${escapeHtml(
                                            ticket.id
                                        )}"
                                    >
                                        Open Ticket →
                                    </button>

                                </div>

                            </article>
                        `;
                    }
                )
                .join(
                    ""
                );
    }


    /* =========================================================
       BREACHES
    ========================================================= */

    function getBreachedTickets() {

        return liveTickets
            .filter(
                ticket => {

                    if (
                        ticket.slaBreached
                    ) {

                        return true;
                    }


                    return (
                        isActive(
                            ticket
                        ) &&
                        getRemainingMs(
                            ticket
                        ) !==
                            null &&
                        getRemainingMs(
                            ticket
                        ) <=
                            0
                    );
                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    getBreachMilliseconds(
                        b
                    ) -
                    getBreachMilliseconds(
                        a
                    )
            );
    }


    function getBreachMilliseconds(
        ticket
    ) {

        if (
            !ticket.resolutionDueAt
        ) {

            return 0;
        }


        const due =
            new Date(
                ticket.resolutionDueAt
            );


        let end =
            Date.now();


        if (
            ticket.resolvedAt
        ) {

            end =
                new Date(
                    ticket.resolvedAt
                ).getTime();

        } else if (
            ticket.closedAt
        ) {

            end =
                new Date(
                    ticket.closedAt
                ).getTime();
        }


        if (
            Number.isNaN(
                due.getTime()
            ) ||
            Number.isNaN(
                end
            )
        ) {

            return 0;
        }


        return Math.max(
            0,
            end -
            due.getTime()
        );
    }


    function renderBreaches() {

        const rows =
            get(
                "breachRows"
            );


        if (!rows) {
            return;
        }


        const breached =
            getBreachedTickets();


        if (
            breached.length ===
            0
        ) {

            rows.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        style="
                            padding:24px;
                            text-align:center;
                            color:#716579;
                        "
                    >
                        No SLA breaches.
                    </td>
                </tr>
            `;


            return;
        }


        rows.innerHTML =
            breached
                .slice(
                    0,
                    12
                )
                .map(
                    ticket => {

                        return `
                            <tr>

                                <td>

                                    <button
                                        type="button"
                                        class="
                                            ticket-link
                                            live-open-ticket
                                        "
                                        data-ticket-id="${escapeHtml(
                                            ticket.id
                                        )}"
                                        style="
                                            border:0;
                                            background:none;
                                            cursor:pointer;
                                        "
                                    >
                                        ${escapeHtml(
                                            ticket.ticketNumber
                                        )}
                                    </button>

                                </td>


                                <td>
                                    ${escapeHtml(
                                        ticket.subject
                                    )}
                                </td>


                                <td>

                                    <span
                                        class="priority ${escapeHtml(
                                            ticket.priority
                                                .toLowerCase()
                                        )}"
                                    >
                                        ${escapeHtml(
                                            ticket.priority
                                        )}
                                    </span>

                                </td>


                                <td>
                                    ${escapeHtml(
                                        ticket.technician
                                    )}
                                </td>


                                <td>

                                    <span class="breach-time">
                                        ${escapeHtml(
                                            formatDuration(
                                                getBreachMilliseconds(
                                                    ticket
                                                )
                                            )
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <button
                                        type="button"
                                        class="
                                            open-ticket
                                            live-open-ticket
                                        "
                                        data-ticket-id="${escapeHtml(
                                            ticket.id
                                        )}"
                                    >
                                        Open →
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join(
                    ""
                );
    }


    /* =========================================================
       STATS
    ========================================================= */

    function updateStats() {

        const active =
            liveTickets.filter(
                ticket =>
                    isActive(
                        ticket
                    ) &&
                    ticket.resolutionDueAt
            );


        const risk =
            active.filter(
                ticket =>
                    getCondition(
                        ticket
                    ) ===
                    "risk"
            );


        const breached =
            getBreachedTickets();


        setText(
            "activeCount",
            active.length
        );


        setText(
            "riskCount",
            risk.length
        );


        setText(
            "breachCount",
            breached.length
        );


        setText(
            "slaBadge",
            risk.length
        );


        const riskBadge =
            get(
                "riskBadge"
            );


        if (riskBadge) {

            riskBadge.textContent =
                `${risk.length} requiring attention`;
        }


        updateAverageResolution();

        updateCompliance();
    }


    function setText(
        id,
        value
    ) {

        const element =
            get(
                id
            );


        if (element) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       AVERAGE RESOLUTION
    ========================================================= */

    function updateAverageResolution() {

        const completed =
            liveTickets
                .filter(
                    ticket =>
                        ticket.createdAt &&
                        (
                            ticket.resolvedAt ||
                            ticket.closedAt
                        )
                )
                .map(
                    ticket => {

                        const start =
                            new Date(
                                ticket.createdAt
                            ).getTime();


                        const end =
                            new Date(
                                ticket.resolvedAt ||
                                ticket.closedAt
                            ).getTime();


                        return (
                            end -
                            start
                        );
                    }
                )
                .filter(
                    value =>
                        Number.isFinite(
                            value
                        ) &&
                        value >= 0
                );


        const statCards =
            [
                ...document.querySelectorAll(
                    ".stats .stat"
                )
            ];


        if (
            statCards.length <
            4
        ) {

            return;
        }


        const strong =
            statCards[3]
                .querySelector(
                    "strong"
                );


        if (!strong) {
            return;
        }


        if (
            completed.length ===
            0
        ) {

            strong.textContent =
                "—";

            return;
        }


        const average =
            completed.reduce(
                (
                    total,
                    value
                ) =>
                    total +
                    value,
                0
            ) /
            completed.length;


        strong.textContent =
            formatAverageDuration(
                average
            );
    }


    function formatAverageDuration(
        milliseconds
    ) {

        const minutes =
            Math.round(
                milliseconds /
                60000
            );


        if (
            minutes <
            60
        ) {

            return `${minutes}m`;
        }


        const hours =
            Math.floor(
                minutes /
                60
            );


        const remainder =
            minutes %
            60;


        if (
            hours <
            24
        ) {

            return `${hours}h ${remainder}m`;
        }


        const days =
            Math.floor(
                hours /
                24
            );


        return `${days}d ${hours % 24}h`;
    }


    /* =========================================================
       SLA COMPLIANCE
    ========================================================= */

    function updateCompliance() {

        const tracked =
            liveTickets.filter(
                ticket =>
                    ticket.resolutionDueAt
            );


        const breached =
            tracked.filter(
                ticket =>
                    getCondition(
                        ticket
                    ) ===
                        "breached"
            );


        const percent =
            tracked.length
                ? Math.round(
                    (
                        tracked.length -
                        breached.length
                    ) /
                    tracked.length *
                    100
                )
                : 100;


        const card =
            document.querySelector(
                ".health-card"
            );


        if (!card) {
            return;
        }


        const strong =
            card.querySelector(
                "strong"
            );


        if (strong) {

            strong.textContent =
                `${percent}%`;
        }


        const progress =
            card.querySelector(
                ".progress span, .health-progress span, .health-bar span"
            );


        if (progress) {

            progress.style.width =
                `${percent}%`;
        }
    }


    /* =========================================================
       SLA POLICIES

       Uses DB data if meta route exposes it.
       Otherwise existing policy cards remain.
    ========================================================= */

    async function updatePolicies() {

        try {

            const data =
                await api(
                    "/api/tickets/meta/options"
                );


            const policies =
                data.slaPolicies ||
                data.sla_policies ||
                [];


            if (
                !Array.isArray(
                    policies
                ) ||
                policies.length ===
                    0
            ) {

                return;
            }


            const container =
                document.querySelector(
                    ".policies"
                );


            if (!container) {
                return;
            }


            container.innerHTML =
                policies
                    .map(
                        policy => {

                            const priority =
                                normalizePriority(
                                    firstValue(
                                        policy,
                                        [
                                            "priority"
                                        ],
                                        "MEDIUM"
                                    )
                                );


                            const response =
                                Number(
                                    firstValue(
                                        policy,
                                        [
                                            "firstResponseMinutes",
                                            "first_response_minutes",
                                            "responseMinutes",
                                            "response_minutes"
                                        ],
                                        0
                                    )
                                );


                            const resolution =
                                Number(
                                    firstValue(
                                        policy,
                                        [
                                            "resolutionMinutes",
                                            "resolution_minutes"
                                        ],
                                        0
                                    )
                                );


                            return `
                                <article class="policy">

                                    <div class="policy-top">

                                        <div class="policy-name">

                                            <span
                                                class="
                                                    policy-dot
                                                    ${escapeHtml(
                                                        priority
                                                            .toLowerCase()
                                                    )}
                                                "
                                            ></span>

                                            <strong>
                                                ${escapeHtml(
                                                    priority
                                                )}
                                            </strong>

                                        </div>

                                        <span class="policy-status">
                                            Active
                                        </span>

                                    </div>


                                    <div class="policy-grid">

                                        <div class="policy-item">

                                            <small>
                                                First Response
                                            </small>

                                            <span>
                                                ${escapeHtml(
                                                    formatPolicyMinutes(
                                                        response
                                                    )
                                                )}
                                            </span>

                                        </div>


                                        <div class="policy-item">

                                            <small>
                                                Resolution
                                            </small>

                                            <span>
                                                ${escapeHtml(
                                                    formatPolicyMinutes(
                                                        resolution
                                                    )
                                                )}
                                            </span>

                                        </div>

                                    </div>

                                </article>
                            `;
                        }
                    )
                    .join(
                        ""
                    );

        } catch (error) {

            console.warn(
                "SLA policy metadata unavailable:",
                error
            );
        }
    }


    function formatPolicyMinutes(
        minutes
    ) {

        if (
            minutes <
            60
        ) {

            return `${minutes} min`;
        }


        if (
            minutes %
            60 ===
            0
        ) {

            return `${
                minutes /
                60
            } hr`;
        }


        return `${
            Math.floor(
                minutes /
                60
            )
        }h ${
            minutes %
            60
        }m`;
    }


    /* =========================================================
       LIVE COUNTDOWN
    ========================================================= */

    function updateCountdowns() {

        document
            .querySelectorAll(
                "[data-live-sla-id]"
            )
            .forEach(
                element => {

                    const id =
                        element.dataset
                            .liveSlaId;


                    const ticket =
                        liveTickets.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    id
                                )
                        );


                    if (!ticket) {
                        return;
                    }


                    element.textContent =
                        formatDuration(
                            getRemainingMs(
                                ticket
                            )
                        );


                    const condition =
                        getCondition(
                            ticket
                        );


                    element.classList.remove(
                        "healthy",
                        "risk",
                        "breached"
                    );


                    element.classList.add(
                        condition
                    );
                }
            );
    }


    /* =========================================================
       OPEN TICKET
    ========================================================= */

    function setupTicketClicks() {

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".live-open-ticket"
                    );


                if (!button) {
                    return;
                }


                const id =
                    button.dataset
                        .ticketId;


                if (!id) {
                    return;
                }


                window.location.href =
                    `/ticket-detail.html?id=${
                        encodeURIComponent(
                            id
                        )
                    }`;
            }
        );
    }


    /* =========================================================
       FILTER EVENTS

       Capture phase prevents old demo filters
       from rendering demo tickets again.
    ========================================================= */

    function setupFilters() {

        [
            "priorityFilter",
            "riskFilter"
        ]
            .forEach(
                id => {

                    const element =
                        get(
                            id
                        );


                    if (!element) {
                        return;
                    }


                    element.addEventListener(
                        "change",
                        event => {

                            event.stopImmediatePropagation();


                            renderRiskTickets();

                        },
                        true
                    );
                }
            );


        const search =
            get(
                "topSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                event => {

                    event.stopImmediatePropagation();


                    renderRiskTickets();

                },
                true
            );
        }
    }


    /* =========================================================
       REFRESH
    ========================================================= */

    function setupRefresh() {

        const button =
            get(
                "refreshButton"
            );


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                event.stopImmediatePropagation();


                try {

                    await refreshAll();


                    showToast(
                        "SLA monitor refreshed."
                    );

                } catch (error) {

                    showToast(
                        error.message
                    );
                }

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


        if (!toast) {

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
       EXTRA CSS
    ========================================================= */

    function installStyles() {

        const style =
            document.createElement(
                "style"
            );


        style.textContent = `

            .risk-ticket .sla.healthy {
                color: #67AECA;
            }

            .risk-ticket .sla.risk {
                color: #d5afcf;
            }

            .risk-ticket .sla.breached {
                color: #E52A6F;
                font-weight: 950;
            }

            .ticket-link {
                font: inherit;
            }

        `;


        document.head.appendChild(
            style
        );
    }


    /* =========================================================
       DISABLE OLD DEMO TIMER DATA
    ========================================================= */

    function disableOldDemoData() {

        /*
            sla-monitor.html currently has a global:
            let activeTickets = [...]

            Its old 1-second timer can continue running.
            Emptying the old array prevents it from
            overwriting live countdown values.
        */

        try {

            if (
                typeof activeTickets !==
                "undefined"
            ) {

                activeTickets =
                    [];
            }

        } catch (error) {

            console.warn(
                "Old demo SLA state could not be cleared."
            );
        }
    }


    /* =========================================================
       RENDER
    ========================================================= */

    function renderAll() {

        renderRiskTickets();

        renderBreaches();

        updateStats();

        updateCountdowns();
    }


    /* =========================================================
       REFRESH DATA
    ========================================================= */

    async function refreshAll() {

        await loadTickets();

        renderAll();
    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    async function initialize() {

        installStyles();

        disableOldDemoData();

        setupFilters();

        setupRefresh();

        setupTicketClicks();


        try {

            await loadCurrentUser();

            await refreshAll();

            await updatePolicies();

        } catch (error) {

            console.error(
                "❌ SLA monitor failed:",
                error
            );


            showToast(
                error.message
            );
        }


        clearInterval(
            clockTimer
        );


        clockTimer =
            setInterval(
                updateCountdowns,
                1000
            );


        clearInterval(
            refreshTimer
        );


        refreshTimer =
            setInterval(
                async () => {

                    try {

                        await refreshAll();

                    } catch (error) {

                        console.error(
                            "SLA auto refresh failed:",
                            error
                        );
                    }

                },
                30000
            );
    }


    initialize();

})();