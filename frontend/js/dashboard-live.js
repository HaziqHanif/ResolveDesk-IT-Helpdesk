(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let currentUser = null;
    let tickets = [];
    let historyItems = [];

    let refreshTimer = null;


    /* =========================================================
       HELPERS
    ========================================================= */

    function firstValue(
        object,
        keys,
        fallback = null
    ) {

        for (const key of keys) {

            if (
                object?.[key] !== undefined &&
                object?.[key] !== null
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
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function label(
        value
    ) {

        return String(
            value || ""
        )
            .replaceAll("_", " ")
            .replaceAll("-", " ")
            .toLowerCase()
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    function initials(
        value
    ) {

        return String(
            value || "RD"
        )
            .trim()
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


    function normalizeStatus(
        value
    ) {

        return String(
            value || "OPEN"
        )
            .trim()
            .toUpperCase()
            .replaceAll("-", "_")
            .replaceAll(" ", "_");
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


    function sameDay(
        value,
        reference =
            new Date()
    ) {

        if (!value) {
            return false;
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return false;
        }


        return (
            date.getFullYear() ===
                reference.getFullYear() &&

            date.getMonth() ===
                reference.getMonth() &&

            date.getDate() ===
                reference.getDate()
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

                    ...options,

                    headers: {

                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers || {})

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
            response.status === 401
        ) {

            window.location.replace(
                "/login.html"
            );

            throw new Error(
                "Authentication required."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Request failed."
            );
        }


        return data;
    }


    /* =========================================================
       USER
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


        currentUser =
            data.user;


        renderProfile();
    }


    function renderProfile() {

        const name =
            currentUser?.fullName ||
            currentUser?.name ||
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
                initials(
                    name
                );
        }
    }


    /* =========================================================
       NORMALIZE TICKET
    ========================================================= */

    function normalizeTicket(
        row
    ) {

        const resolutionDueAt =
            firstValue(
                row,
                [
                    "resolutionDueAt",
                    "resolution_due_at"
                ]
            );


        let slaMinutes =
            null;


        if (resolutionDueAt) {

            const due =
                new Date(
                    resolutionDueAt
                );


            if (
                !Number.isNaN(
                    due.getTime()
                )
            ) {

                slaMinutes =
                    (
                        due.getTime() -
                        Date.now()
                    ) /
                    60000;
            }
        }


        return {

            id:
                firstValue(
                    row,
                    ["id"]
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
                    ["subject"],
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
                    "Uncategorised"
                ),

            assignedTo:
                firstValue(
                    row,
                    [
                        "assignedTo",
                        "assigned_to"
                    ]
                ),

            assigneeName:
                firstValue(
                    row,
                    [
                        "assigneeName",
                        "assignee_name",
                        "technicianName",
                        "technician_name"
                    ],
                    "Unassigned"
                ),

            priority:
                normalizePriority(
                    firstValue(
                        row,
                        ["priority"],
                        "MEDIUM"
                    )
                ),

            status:
                normalizeStatus(
                    firstValue(
                        row,
                        ["status"],
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

            resolutionDueAt,

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

            slaMinutes

        };
    }


    /* =========================================================
       LOAD TICKETS
    ========================================================= */

    async function loadTickets() {

        const data =
            await api(
                "/api/tickets"
            );


        const rows =
            Array.isArray(data)
                ? data
                : (
                    data.tickets ||
                    data.data ||
                    []
                );


        tickets =
            rows.map(
                normalizeTicket
            );
    }


    /* =========================================================
       ACTIVE / BREACH HELPERS
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


    function isBreached(
        ticket
    ) {

        if (
            !isActive(ticket)
        ) {

            return false;
        }


        if (
            ticket.slaBreached
        ) {

            return true;
        }


        return (
            Number.isFinite(
                ticket.slaMinutes
            ) &&
            ticket.slaMinutes <= 0
        );
    }


    /* =========================================================
       STAT CARDS
    ========================================================= */

    function renderStats() {

        const statCards =
            [
                ...document.querySelectorAll(
                    ".stat-grid .stat"
                )
            ];


        if (
            statCards.length < 4
        ) {

            return;
        }


        const open =
            tickets.filter(
                ticket =>
                    ticket.status ===
                    "OPEN"
            );


        const progress =
            tickets.filter(
                ticket =>
                    ticket.status ===
                    "IN_PROGRESS"
            );


        const resolvedToday =
            tickets.filter(
                ticket =>
                    [
                        "RESOLVED",
                        "CLOSED"
                    ].includes(
                        ticket.status
                    ) &&
                    sameDay(
                        ticket.resolvedAt ||
                        ticket.closedAt ||
                        ticket.updatedAt
                    )
            );


        const breaches =
            tickets.filter(
                isBreached
            );


        const createdToday =
            tickets.filter(
                ticket =>
                    sameDay(
                        ticket.createdAt
                    )
            ).length;


        setStat(
            statCards[0],
            open.length,
            `+${createdToday} today`
        );


        const progressPercent =
            tickets.length
                ? (
                    progress.length /
                    tickets.length *
                    100
                ).toFixed(1)
                : "0.0";


        setStat(
            statCards[1],
            progress.length,
            `${progressPercent}%`
        );


        setStat(
            statCards[2],
            resolvedToday.length,
            "Today"
        );


        setStat(
            statCards[3],
            breaches.length,
            breaches.length
                ? "ACTION"
                : "CLEAR"
        );
    }


    function setStat(
        card,
        value,
        chip
    ) {

        const strong =
            card.querySelector(
                ".stat-row strong"
            );


        const badge =
            card.querySelector(
                ".stat-row .chip"
            );


        if (strong) {

            strong.textContent =
                value;
        }


        if (badge) {

            badge.textContent =
                chip;
        }
    }


    /* =========================================================
       SLA HEALTH
    ========================================================= */

    function renderSlaHealth() {

        const active =
            tickets.filter(
                isActive
            );


        const tracked =
            active.filter(
                ticket =>
                    Number.isFinite(
                        ticket.slaMinutes
                    )
            );


        const healthy =
            tracked.filter(
                ticket =>
                    !isBreached(
                        ticket
                    )
            );


        const percent =
            tracked.length
                ? Math.round(
                    healthy.length /
                    tracked.length *
                    100
                )
                : 100;


        const heroSide =
            document.querySelector(
                ".hero-side"
            );


        if (!heroSide) {
            return;
        }


        const strong =
            heroSide.querySelector(
                "strong"
            );


        const progress =
            heroSide.querySelector(
                ".hero-progress span"
            );


        const copy =
            heroSide.querySelector(
                "p"
            );


        if (strong) {

            strong.textContent =
                `${percent}%`;
        }


        if (progress) {

            progress.style.width =
                `${percent}%`;
        }


        if (copy) {

            copy.textContent =
                tracked.length
                    ? `${healthy.length} of ${tracked.length} active SLA-tracked tickets remain inside their target.`
                    : "No active SLA deadlines currently require attention.";
        }
    }


    /* =========================================================
       SLA FORMAT
    ========================================================= */

    function formatSla(
        ticket
    ) {

        if (
            !Number.isFinite(
                ticket.slaMinutes
            )
        ) {

            return {
                text: "—",
                className: "normal"
            };
        }


        if (
            ticket.slaMinutes <= 0
        ) {

            return {
                text: "BREACHED",
                className: "urgent"
            };
        }


        const total =
            Math.ceil(
                ticket.slaMinutes
            );


        if (total < 60) {

            return {
                text: `${total}m`,
                className: "urgent"
            };
        }


        const hours =
            Math.floor(
                total / 60
            );


        const minutes =
            total % 60;


        if (hours < 24) {

            return {
                text:
                    `${hours}h ${minutes}m`,
                className:
                    hours <= 4
                        ? "urgent"
                        : "normal"
            };
        }


        const days =
            Math.floor(
                hours / 24
            );


        return {
            text:
                `${days}d ${hours % 24}h`,
            className:
                "normal"
        };
    }


    /* =========================================================
       PRIORITY QUEUE
    ========================================================= */

    function renderPriorityQueue() {

        const container =
            document.querySelector(
                ".dashboard-grid .queue"
            );


        if (!container) {
            return;
        }


        const priorityWeight = {
            CRITICAL: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1
        };


        const data =
            tickets
                .filter(
                    isActive
                )
                .sort(
                    (a, b) => {

                        const priority =
                            (
                                priorityWeight[
                                    b.priority
                                ] || 0
                            ) -
                            (
                                priorityWeight[
                                    a.priority
                                ] || 0
                            );


                        if (priority !== 0) {

                            return priority;
                        }


                        return (
                            a.slaMinutes ??
                            Infinity
                        ) -
                        (
                            b.slaMinutes ??
                            Infinity
                        );
                    }
                )
                .slice(
                    0,
                    4
                );


        if (
            data.length === 0
        ) {

            container.innerHTML = `
                <div style="
                    padding:24px;
                    color:#746978;
                    font-size:11px;
                ">
                    No active tickets.
                </div>
            `;

            return;
        }


        container.innerHTML =
            data.map(
                ticket => {

                    const sla =
                        formatSla(
                            ticket
                        );


                    const symbol =
                        ticket.priority ===
                            "CRITICAL"
                            ? "!"
                            : ticket.priority ===
                                "HIGH"
                                ? "↑"
                                : "•";


                    return `
                        <div
                            class="ticket live-dashboard-ticket"
                            data-ticket-id="${escapeHtml(
                                ticket.id
                            )}"
                            style="cursor:pointer;"
                        >

                            <div
                                class="priority ${
                                    ticket.priority ===
                                    "CRITICAL"
                                        ? "critical"
                                        : ""
                                }"
                            >
                                ${symbol}
                            </div>


                            <div>

                                <strong>
                                    ${escapeHtml(
                                        ticket.subject
                                    )}
                                </strong>

                                <div class="meta">

                                    <span>
                                        ${escapeHtml(
                                            ticket.ticketNumber
                                        )}
                                    </span>

                                    <span>
                                        ${escapeHtml(
                                            ticket.category
                                        )}
                                    </span>

                                    <span>
                                        ${escapeHtml(
                                            ticket.department
                                        )}
                                    </span>

                                </div>

                            </div>


                            <div
                                class="sla ${sla.className}"
                            >

                                <strong>
                                    ${escapeHtml(
                                        sla.text
                                    )}
                                </strong>

                                <span>
                                    SLA remaining
                                </span>

                            </div>

                        </div>
                    `;
                }
            ).join("");
    }


    /* =========================================================
       TECHNICIAN WORKLOAD
    ========================================================= */

    function renderWorkload() {

        const container =
            document.querySelector(
                ".bottom-grid .workload"
            );


        if (!container) {
            return;
        }


        const counts =
            new Map();


        tickets
            .filter(
                ticket =>
                    isActive(
                        ticket
                    ) &&
                    ticket.assignedTo &&
                    ticket.assigneeName &&
                    ticket.assigneeName !==
                        "Unassigned"
            )
            .forEach(
                ticket => {

                    const key =
                        ticket.assigneeName;


                    if (
                        !counts.has(key)
                    ) {

                        counts.set(
                            key,
                            {
                                name:
                                    ticket.assigneeName,

                                count:
                                    0,

                                departments:
                                    new Set()
                            }
                        );
                    }


                    const item =
                        counts.get(key);


                    item.count += 1;


                    if (
                        ticket.department &&
                        ticket.department !== "—"
                    ) {

                        item.departments.add(
                            ticket.department
                        );
                    }
                }
            );


        const technicians =
            [
                ...counts.values()
            ]
                .sort(
                    (a, b) =>
                        b.count -
                        a.count
                )
                .slice(
                    0,
                    4
                );


        if (
            technicians.length ===
            0
        ) {

            container.innerHTML = `
                <div style="
                    padding:22px;
                    color:#746978;
                    font-size:11px;
                ">
                    No assigned technician workload yet.
                </div>
            `;

            return;
        }


        const max =
            Math.max(
                ...technicians.map(
                    item =>
                        item.count
                ),
                1
            );


        container.innerHTML =
            technicians.map(
                technician => {

                    const width =
                        Math.round(
                            technician.count /
                            max *
                            100
                        );


                    return `
                        <div class="person">

                            <div class="person-avatar">
                                ${escapeHtml(
                                    initials(
                                        technician.name
                                    )
                                )}
                            </div>


                            <div>

                                <strong>
                                    ${escapeHtml(
                                        technician.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        [
                                            ...technician
                                                .departments
                                        ]
                                            .slice(0, 2)
                                            .join(" · ") ||
                                        "Support Technician"
                                    )}
                                </span>

                            </div>


                            <div class="load">

                                <div class="load-bar">

                                    <i style="
                                        width:${width}%
                                    "></i>

                                </div>

                                <small>
                                    ${technician.count}
                                    ticket${
                                        technician.count === 1
                                            ? ""
                                            : "s"
                                    }
                                </small>

                            </div>

                        </div>
                    `;
                }
            ).join("");
    }


    /* =========================================================
       CATEGORY DISTRIBUTION
    ========================================================= */

    function renderCategories() {

        const categoryPanel =
            [
                ...document.querySelectorAll(
                    ".bottom-grid .panel"
                )
            ].find(
                panel =>
                    panel.textContent.includes(
                        "Ticket Categories"
                    )
            );


        if (!categoryPanel) {
            return;
        }


        const now =
            new Date();


        let source =
            tickets.filter(
                ticket => {

                    if (!ticket.createdAt) {
                        return false;
                    }


                    const created =
                        new Date(
                            ticket.createdAt
                        );


                    return (
                        created.getMonth() ===
                            now.getMonth() &&
                        created.getFullYear() ===
                            now.getFullYear()
                    );
                }
            );


        if (
            source.length === 0
        ) {

            source =
                tickets;
        }


        const map =
            new Map();


        source.forEach(
            ticket => {

                const name =
                    ticket.category ||
                    "Uncategorised";


                map.set(
                    name,
                    (
                        map.get(name) ||
                        0
                    ) + 1
                );
            }
        );


        const categories =
            [
                ...map.entries()
            ]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b[1] -
                        a[1]
                )
                .slice(
                    0,
                    4
                );


        const total =
            source.length;


        const totalElement =
            categoryPanel.querySelector(
                ".donut-center strong"
            );


        if (totalElement) {

            totalElement.textContent =
                total;
        }


        const legend =
            categoryPanel.querySelector(
                ".legend"
            );


        if (legend) {

            const colors = [
                "var(--topaz)",
                "var(--amethyst)",
                "var(--rose)",
                "var(--jewel)"
            ];


            legend.innerHTML =
                categories.map(
                    (
                        [name, count],
                        index
                    ) => {

                        const percent =
                            total
                                ? Math.round(
                                    count /
                                    total *
                                    100
                                )
                                : 0;


                        return `
                            <div class="legend-row">

                                <span>

                                    <i style="
                                        background:
                                            ${colors[index]};
                                    "></i>

                                    ${escapeHtml(
                                        name
                                    )}

                                </span>

                                <strong>
                                    ${percent}%
                                </strong>

                            </div>
                        `;
                    }
                ).join("");
        }


        renderDonut(
            categoryPanel,
            categories,
            total
        );
    }


    function renderDonut(
        panel,
        categories,
        total
    ) {

        const donut =
            panel.querySelector(
                ".donut"
            );


        if (
            !donut ||
            !total ||
            categories.length === 0
        ) {

            return;
        }


        const colors = [
            "var(--topaz)",
            "var(--amethyst)",
            "var(--rose)",
            "var(--jewel)"
        ];


        let start =
            0;


        const stops =
            categories.map(
                (
                    [, count],
                    index
                ) => {

                    const percent =
                        count /
                        total *
                        100;


                    const end =
                        start +
                        percent;


                    const segment =
                        `${
                            colors[index]
                        } ${
                            start
                        }% ${
                            end
                        }%`;


                    start =
                        end;


                    return segment;
                }
            );


        if (
            start < 100
        ) {

            stops.push(
                `rgba(255,255,255,.04) ${start}% 100%`
            );
        }


        donut.style.background =
            `conic-gradient(${stops.join(",")})`;
    }


    /* =========================================================
       RECENT ACTIVITY
    ========================================================= */

    async function loadRecentHistory() {

        const newest =
            [...tickets]
                .sort(
                    (a, b) =>
                        new Date(
                            b.updatedAt ||
                            b.createdAt ||
                            0
                        ) -
                        new Date(
                            a.updatedAt ||
                            a.createdAt ||
                            0
                        )
                )
                .slice(
                    0,
                    6
                );


        const results =
            await Promise.allSettled(
                newest.map(
                    ticket =>
                        api(
                            `/api/tickets/${
                                encodeURIComponent(
                                    ticket.id
                                )
                            }`
                        )
                )
            );


        historyItems =
            [];


        results.forEach(
            result => {

                if (
                    result.status !==
                    "fulfilled"
                ) {

                    return;
                }


                const ticket =
                    result.value.ticket;


                const history =
                    result.value.history ||
                    [];


                history.forEach(
                    item => {

                        historyItems.push({

                            ...item,

                            ticketId:
                                ticket?.id,

                            ticketNumber:
                                ticket
                                    ?.ticketNumber,

                            subject:
                                ticket?.subject

                        });
                    }
                );
            }
        );


        historyItems.sort(
            (a, b) =>
                new Date(
                    b.createdAt ||
                    b.created_at ||
                    0
                ) -
                new Date(
                    a.createdAt ||
                    a.created_at ||
                    0
                )
        );
    }


    function activityText(
        item
    ) {

        const action =
            String(
                item.action ||
                ""
            ).toUpperCase();


        switch (action) {

            case "TICKET_CREATED":
                return {
                    icon: "＋",
                    title:
                        `${item.ticketNumber || "Ticket"} submitted`,
                    body:
                        item.subject ||
                        "New support request created."
                };


            case "STATUS_CHANGED":
                return {
                    icon: "✓",
                    title:
                        `${item.ticketNumber || "Ticket"} status changed`,
                    body:
                        `${label(
                            item.oldValue?.status ||
                            ""
                        )} → ${label(
                            item.newValue?.status ||
                            ""
                        )}`
                };


            case "PRIORITY_CHANGED":
                return {
                    icon: "↑",
                    title:
                        `${item.ticketNumber || "Ticket"} priority changed`,
                    body:
                        `${label(
                            item.oldValue?.priority ||
                            ""
                        )} → ${label(
                            item.newValue?.priority ||
                            ""
                        )}`
                };


            case "TICKET_ASSIGNED":
                return {
                    icon: "♙",
                    title:
                        `${item.ticketNumber || "Ticket"} assigned`,
                    body:
                        "Ticket ownership updated."
                };


            case "ATTACHMENTS_ADDED":
                return {
                    icon: "▣",
                    title:
                        `${item.ticketNumber || "Ticket"} attachment added`,
                    body:
                        `${
                            item.metadata?.count ||
                            1
                        } file(s) uploaded.`
                };


            default:
                return {
                    icon: "•",
                    title:
                        `${item.ticketNumber || "Ticket"} updated`,
                    body:
                        label(
                            action ||
                            "Activity"
                        )
                };
        }
    }


    function renderActivity() {

        const container =
            document.querySelector(
                ".bottom-grid .activity"
            );


        if (!container) {
            return;
        }


        const latest =
            historyItems.slice(
                0,
                4
            );


        if (
            latest.length === 0
        ) {

            const fallback =
                [...tickets]
                    .sort(
                        (a, b) =>
                            new Date(
                                b.createdAt ||
                                0
                            ) -
                            new Date(
                                a.createdAt ||
                                0
                            )
                    )
                    .slice(
                        0,
                        4
                    );


            container.innerHTML =
                fallback.map(
                    ticket => `
                        <div
                            class="activity-item live-activity-ticket"
                            data-ticket-id="${escapeHtml(
                                ticket.id
                            )}"
                            style="cursor:pointer;"
                        >

                            <div class="activity-icon">
                                ＋
                            </div>

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        ticket.ticketNumber
                                    )} submitted
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        ticket.subject
                                    )}
                                </p>

                                <time>
                                    ${escapeHtml(
                                        timeAgo(
                                            ticket.createdAt
                                        )
                                    )}
                                </time>

                            </div>

                        </div>
                    `
                ).join("");


            return;
        }


        container.innerHTML =
            latest.map(
                item => {

                    const copy =
                        activityText(
                            item
                        );


                    return `
                        <div
                            class="activity-item live-activity-ticket"
                            data-ticket-id="${escapeHtml(
                                item.ticketId
                            )}"
                            style="cursor:pointer;"
                        >

                            <div class="activity-icon">
                                ${copy.icon}
                            </div>

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        copy.title
                                    )}
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        copy.body
                                    )}
                                </p>

                                <time>
                                    ${escapeHtml(
                                        timeAgo(
                                            item.createdAt ||
                                            item.created_at
                                        )
                                    )}
                                </time>

                            </div>

                        </div>
                    `;
                }
            ).join("");
    }


    function timeAgo(
        value
    ) {

        if (!value) {
            return "Recently";
        }


        const date =
            new Date(value);


        const seconds =
            Math.floor(
                (
                    Date.now() -
                    date.getTime()
                ) /
                1000
            );


        if (
            !Number.isFinite(seconds) ||
            seconds < 0
        ) {

            return "Just now";
        }


        if (seconds < 60) {
            return "Just now";
        }


        const minutes =
            Math.floor(
                seconds / 60
            );


        if (minutes < 60) {

            return `${minutes} minute${
                minutes === 1
                    ? ""
                    : "s"
            } ago`;
        }


        const hours =
            Math.floor(
                minutes / 60
            );


        if (hours < 24) {

            return `${hours} hour${
                hours === 1
                    ? ""
                    : "s"
            } ago`;
        }


        const days =
            Math.floor(
                hours / 24
            );


        return `${days} day${
            days === 1
                ? ""
                : "s"
        } ago`;
    }


    /* =========================================================
       7 DAY CHART
    ========================================================= */

    function renderChart() {

        const svg =
            document.querySelector(
                ".chart svg"
            );


        if (!svg) {
            return;
        }


        const paths =
            svg.querySelectorAll(
                "path"
            );


        if (
            paths.length < 4
        ) {

            return;
        }


        const days = [];


        for (
            let offset = 6;
            offset >= 0;
            offset--
        ) {

            const date =
                new Date();


            date.setHours(
                0,
                0,
                0,
                0
            );


            date.setDate(
                date.getDate() -
                offset
            );


            days.push(
                date
            );
        }


        const created =
            days.map(
                day =>
                    tickets.filter(
                        ticket =>
                            sameDay(
                                ticket.createdAt,
                                day
                            )
                    ).length
            );


        const resolved =
            days.map(
                day =>
                    tickets.filter(
                        ticket =>
                            sameDay(
                                ticket.resolvedAt ||
                                ticket.closedAt,
                                day
                            )
                    ).length
            );


        const max =
            Math.max(
                1,
                ...created,
                ...resolved
            );


        const createdPath =
            makeChartPath(
                created,
                max
            );


        const resolvedPath =
            makeChartPath(
                resolved,
                max
            );


        paths[0].setAttribute(
            "d",
            `${createdPath} L700,210 L0,210 Z`
        );


        paths[1].setAttribute(
            "d",
            createdPath
        );


        paths[2].setAttribute(
            "d",
            `${resolvedPath} L700,210 L0,210 Z`
        );


        paths[3].setAttribute(
            "d",
            resolvedPath
        );


        const labels =
            document.querySelectorAll(
                ".chart-labels span"
            );


        labels.forEach(
            (
                element,
                index
            ) => {

                if (!days[index]) {
                    return;
                }


                element.textContent =
                    days[index]
                        .toLocaleDateString(
                            "en-MY",
                            {
                                weekday:
                                    "short"
                            }
                        );
            }
        );
    }


    function makeChartPath(
        values,
        max
    ) {

        return values.map(
            (
                value,
                index
            ) => {

                const x =
                    index *
                    (
                        700 /
                        6
                    );


                const y =
                    190 -
                    (
                        value /
                        max
                    ) *
                    145;


                return `${
                    index === 0
                        ? "M"
                        : "L"
                }${x.toFixed(1)},${y.toFixed(1)}`;
            }
        ).join(" ");
    }


    /* =========================================================
       CLICK EVENTS
    ========================================================= */

    function setupClicks() {

        document.addEventListener(
            "click",
            event => {

                const item =
                    event.target.closest(
                        ".live-dashboard-ticket, .live-activity-ticket"
                    );


                if (!item) {
                    return;
                }


                const id =
                    item.dataset.ticketId;


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
       REMOVE OLD DEMO CREATE MODAL
    ========================================================= */

    function removeDemoModal() {

        document.getElementById(
            "ticketModal"
        )?.remove();
    }


    /* =========================================================
       RENDER EVERYTHING
    ========================================================= */

    async function renderDashboard() {

        await loadTickets();


        renderStats();

        renderSlaHealth();

        renderPriorityQueue();

        renderWorkload();

        renderCategories();

        renderChart();


        try {

            await loadRecentHistory();

        } catch (error) {

            console.warn(
                "Recent ticket history unavailable:",
                error
            );
        }


        renderActivity();


        console.log(
            "✅ ResolveDesk dashboard live:",
            tickets
        );
    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    async function initialize() {

        setupClicks();


        /*
            create-ticket-nav.js already handles
            the Create Ticket button.

            Old modal is no longer needed.
        */

        removeDemoModal();


        try {

            await loadUser();

            await renderDashboard();

        } catch (error) {

            console.error(
                "❌ Dashboard load failed:",
                error
            );
        }


        refreshTimer =
            setInterval(
                async () => {

                    try {

                        await renderDashboard();

                    } catch (error) {

                        console.error(
                            "Dashboard refresh failed:",
                            error
                        );
                    }

                },
                30000
            );
    }


    initialize();

})();