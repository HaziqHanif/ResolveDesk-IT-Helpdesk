(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let currentUser =
        null;

    let queueTickets =
        [];

    let refreshTimer =
        null;

    let toastTimer =
        null;


    /* =========================================================
       HELPERS
    ========================================================= */

    function get(id) {

        return document.getElementById(
            id
        );
    }


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


    function normalizeStatus(
        value
    ) {

        return String(
            value || "OPEN"
        )
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
            .toUpperCase();
    }


    function statusClass(
        value
    ) {

        return normalizeStatus(
            value
        )
            .toLowerCase()
            .replaceAll(
                "_",
                "-"
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


        if (
            !response.ok
        ) {

            const error =
                new Error(
                    data.message ||
                    "Request failed."
                );


            error.status =
                response.status;


            throw error;
        }


        return data;
    }


    /* =========================================================
       USER
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


        updateProfile();
    }


    function updateProfile() {

        if (!currentUser) {
            return;
        }


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
                getInitials(
                    name
                );
        }
    }


    function getInitials(
        name
    ) {

        return String(
            name || "RD"
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
       NORMALIZE TICKET
    ========================================================= */

    function normalizeTicket(
        row
    ) {

        const id =
            firstValue(
                row,
                [
                    "id"
                ]
            );


        const ticketNumber =
            firstValue(
                row,
                [
                    "ticketNumber",
                    "ticket_number"
                ],
                `#${id}`
            );


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


        if (
            resolutionDueAt
        ) {

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

            id,

            ticketNumber,

            subject:
                firstValue(
                    row,
                    [
                        "subject"
                    ],
                    "Untitled ticket"
                ),

            description:
                firstValue(
                    row,
                    [
                        "description"
                    ],
                    ""
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

            priority:
                normalizePriority(
                    firstValue(
                        row,
                        [
                            "priority"
                        ],
                        "MEDIUM"
                    )
                ),

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
                        "assignee_name"
                    ],
                    "Unassigned"
                ),

            createdAt:
                firstValue(
                    row,
                    [
                        "createdAt",
                        "created_at"
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
       LOAD QUEUE
    ========================================================= */

    async function loadQueue(
        {
            silent = false
        } = {}
    ) {

        try {

            const data =
                await api(
                    "/api/tickets/my-queue"
                );


            const rows =
                Array.isArray(
                    data
                )
                    ? data
                    : (
                        data.tickets ||
                        data.queue ||
                        data.data ||
                        []
                    );


            queueTickets =
                rows.map(
                    normalizeTicket
                );


            renderQueue();

            updateStats();

            updateAvailability();


            console.log(
                "✅ ResolveDesk live queue:",
                queueTickets
            );

        } catch (error) {

            console.error(
                "❌ Queue load failed:",
                error
            );


            if (
                error.status === 403
            ) {

                showQueueMessage(
                    "Technician queue unavailable",
                    "This workspace is available to technicians and administrators."
                );

                return;
            }


            if (!silent) {

                showQueueMessage(
                    "Unable to load queue",
                    error.message
                );
            }
        }
    }


    /* =========================================================
       FILTER
    ========================================================= */

    function filteredTickets() {

        const mainSearch =
            String(
                get(
                    "searchInput"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const topSearch =
            String(
                get(
                    "topSearch"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const search =
            mainSearch ||
            topSearch;


        const status =
            normalizeStatus(
                get(
                    "statusFilter"
                )?.value ||
                ""
            );


        const priority =
            normalizePriority(
                get(
                    "priorityFilter"
                )?.value ||
                ""
            );


        return queueTickets.filter(
            ticket => {

                const text =
                    [
                        ticket.ticketNumber,
                        ticket.subject,
                        ticket.description,
                        ticket.requester,
                        ticket.department,
                        ticket.category
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


                const selectedStatus =
                    get(
                        "statusFilter"
                    )?.value ||
                    "";


                const matchesStatus =
                    !selectedStatus ||
                    ticket.status ===
                        status;


                const selectedPriority =
                    get(
                        "priorityFilter"
                    )?.value ||
                    "";


                const matchesPriority =
                    !selectedPriority ||
                    ticket.priority ===
                        priority;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesPriority
                );
            }
        );
    }


    /* =========================================================
       SLA
    ========================================================= */

    function getSlaInfo(
        ticket
    ) {

        if (
            [
                "RESOLVED",
                "CLOSED"
            ].includes(
                ticket.status
            )
        ) {

            return {

                text:
                    "Completed",

                className:
                    "safe",

                width:
                    100

            };
        }


        if (
            !Number.isFinite(
                ticket.slaMinutes
            )
        ) {

            return {

                text:
                    "No SLA",

                className:
                    "",

                width:
                    0

            };
        }


        if (
            ticket.slaBreached ||
            ticket.slaMinutes <= 0
        ) {

            return {

                text:
                    "SLA Breached",

                className:
                    "critical",

                width:
                    100

            };
        }


        const minutes =
            Math.ceil(
                ticket.slaMinutes
            );


        let text;


        if (
            minutes < 60
        ) {

            text =
                `${minutes}m`;

        } else if (
            minutes < 1440
        ) {

            const hours =
                Math.floor(
                    minutes /
                    60
                );


            const remainder =
                minutes %
                60;


            text =
                `${hours}h ${remainder}m`;

        } else {

            const days =
                Math.floor(
                    minutes /
                    1440
                );


            const hours =
                Math.floor(
                    (
                        minutes %
                        1440
                    ) /
                    60
                );


            text =
                `${days}d ${hours}h`;
        }


        let className =
            "safe";


        if (
            minutes <= 60
        ) {

            className =
                "critical";

        } else if (
            minutes <= 240
        ) {

            className =
                "warning";
        }


        /*
            Visual progress only.
            8 hours = healthy/full reference.
        */

        const width =
            Math.max(
                5,
                Math.min(
                    100,
                    (
                        minutes /
                        480
                    ) *
                    100
                )
            );


        return {

            text,
            className,
            width

        };
    }


    /* =========================================================
       RENDER QUEUE
    ========================================================= */

    function renderQueue() {

        const grid =
            get(
                "queueGrid"
            );


        const empty =
            get(
                "emptyState"
            );


        if (!grid) {
            return;
        }


        const data =
            filteredTickets();


        if (
            data.length === 0
        ) {

            grid.innerHTML =
                "";


            if (empty) {

                empty.style.display =
                    "block";
            }


            return;
        }


        if (empty) {

            empty.style.display =
                "none";
        }


        grid.innerHTML =
            data
                .map(
                    ticket => {

                        const sla =
                            getSlaInfo(
                                ticket
                            );


                        const canTake =
                            !ticket.assignedTo &&
                            currentUser?.role ===
                                "TECHNICIAN";


                        const canWork =
                            (
                                currentUser?.role ===
                                    "ADMIN" ||
                                String(
                                    ticket.assignedTo ||
                                    ""
                                ) ===
                                String(
                                    currentUser?.id ||
                                    ""
                                )
                            );


                        return `
                            <article
                                class="ticket-card live-queue-ticket"
                                data-ticket-id="${escapeHtml(
                                    ticket.id
                                )}"
                            >

                                <div class="ticket-top">

                                    <div>

                                        <span class="ticket-id">
                                            ${escapeHtml(
                                                ticket.ticketNumber
                                            )}
                                        </span>

                                        <h3>
                                            ${escapeHtml(
                                                ticket.subject
                                            )}
                                        </h3>

                                        <p>
                                            ${escapeHtml(
                                                ticket.description ||
                                                "No additional description."
                                            )}
                                        </p>

                                    </div>


                                    <span
                                        class="priority ${escapeHtml(
                                            ticket.priority.toLowerCase()
                                        )}"
                                    >
                                        ${escapeHtml(
                                            ticket.priority
                                        )}
                                    </span>

                                </div>


                                <div class="ticket-meta">

                                    <div>

                                        <small>
                                            Requester
                                        </small>

                                        <strong>
                                            ${escapeHtml(
                                                ticket.requester
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <small>
                                            Department
                                        </small>

                                        <strong>
                                            ${escapeHtml(
                                                ticket.department
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <small>
                                            Category
                                        </small>

                                        <strong>
                                            ${escapeHtml(
                                                ticket.category
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <small>
                                            Status
                                        </small>

                                        <strong
                                            class="status ${escapeHtml(
                                                statusClass(
                                                    ticket.status
                                                )
                                            )}"
                                        >
                                            ${escapeHtml(
                                                label(
                                                    ticket.status
                                                )
                                            )}
                                        </strong>

                                    </div>

                                </div>


                                <div class="sla-section">

                                    <div class="sla-row">

                                        <span>
                                            SLA remaining
                                        </span>

                                        <strong
                                            class="sla ${escapeHtml(
                                                sla.className
                                            )}"
                                        >
                                            ${escapeHtml(
                                                sla.text
                                            )}
                                        </strong>

                                    </div>


                                    <div class="sla-track">

                                        <span
                                            class="${escapeHtml(
                                                sla.className
                                            )}"
                                            style="
                                                width:${sla.width}%;
                                            "
                                        ></span>

                                    </div>

                                </div>


                                <div class="ticket-actions">

                                    <button
                                        type="button"
                                        class="secondary-button live-open-ticket"
                                        data-ticket-id="${escapeHtml(
                                            ticket.id
                                        )}"
                                    >
                                        Open Ticket →
                                    </button>


                                    ${
                                        canTake
                                            ? `
                                                <button
                                                    type="button"
                                                    class="primary-button live-take-ticket"
                                                    data-ticket-id="${escapeHtml(
                                                        ticket.id
                                                    )}"
                                                >
                                                    Assign To Me
                                                </button>
                                            `
                                            : ""
                                    }


                                    ${
                                        canWork &&
                                        ticket.status ===
                                            "OPEN"
                                            ? `
                                                <button
                                                    type="button"
                                                    class="primary-button live-start-ticket"
                                                    data-ticket-id="${escapeHtml(
                                                        ticket.id
                                                    )}"
                                                >
                                                    Start Work
                                                </button>
                                            `
                                            : ""
                                    }


                                    ${
                                        canWork &&
                                        ![
                                            "RESOLVED",
                                            "CLOSED"
                                        ].includes(
                                            ticket.status
                                        )
                                            ? `
                                                <button
                                                    type="button"
                                                    class="resolve-button live-resolve-ticket"
                                                    data-ticket-id="${escapeHtml(
                                                        ticket.id
                                                    )}"
                                                >
                                                    Resolve
                                                </button>
                                            `
                                            : ""
                                    }

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
       STATS
    ========================================================= */

    function updateStats() {

        const active =
            queueTickets.filter(
                ticket =>
                    ![
                        "RESOLVED",
                        "CLOSED"
                    ].includes(
                        ticket.status
                    )
            );


        setText(
            "totalCount",
            active.length
        );


        setText(
            "queueBadge",
            active.length
        );


        setText(
            "progressCount",
            queueTickets.filter(
                ticket =>
                    ticket.status ===
                    "IN_PROGRESS"
            ).length
        );


        setText(
            "resolvedCount",
            queueTickets.filter(
                ticket =>
                    ticket.status ===
                    "RESOLVED"
            ).length
        );


        setText(
            "riskCount",
            active.filter(
                ticket =>
                    Number.isFinite(
                        ticket.slaMinutes
                    ) &&
                    ticket.slaMinutes <=
                        60
            ).length
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


        if (element) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       HERO AVAILABILITY
    ========================================================= */

    function updateAvailability() {

        const span =
            document.querySelector(
                ".availability span"
            );


        if (!span) {
            return;
        }


        const active =
            queueTickets.filter(
                ticket =>
                    ![
                        "RESOLVED",
                        "CLOSED"
                    ].includes(
                        ticket.status
                    )
            ).length;


        span.textContent =
            `${active} active ticket${
                active === 1
                    ? ""
                    : "s"
            } in queue`;
    }


    /* =========================================================
       OPEN TICKET
    ========================================================= */

    function openTicket(
        ticketId
    ) {

        window.location.href =
            `/ticket-detail.html?id=${
                encodeURIComponent(
                    ticketId
                )
            }`;
    }


    /* =========================================================
       ASSIGN TO ME
    ========================================================= */

    async function takeTicket(
        ticketId
    ) {

        try {

            /*
                Backend assign route supports
                self-assignment when assignedTo
                is omitted.
            */

            await api(
                `/api/tickets/${
                    encodeURIComponent(
                        ticketId
                    )
                }/assign`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({})
                }
            );


            showToast(
                "Ticket assigned to you."
            );


            await loadQueue({
                silent:
                    true
            });

        } catch (error) {

            showToast(
                error.message
            );
        }
    }


    /* =========================================================
       START WORK
    ========================================================= */

    async function startWork(
        ticketId
    ) {

        try {

            await api(
                `/api/tickets/${
                    encodeURIComponent(
                        ticketId
                    )
                }/status`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            status:
                                "IN_PROGRESS"
                        })
                }
            );


            showToast(
                "Ticket moved to In Progress."
            );


            await loadQueue({
                silent:
                    true
            });

        } catch (error) {

            showToast(
                error.message
            );
        }
    }


    /* =========================================================
       RESOLVE
    ========================================================= */

    async function resolveTicket(
        ticketId
    ) {

        const resolutionNote =
            prompt(
                "Resolution note:"
            );


        if (
            resolutionNote ===
            null
        ) {

            return;
        }


        try {

            await api(
                `/api/tickets/${
                    encodeURIComponent(
                        ticketId
                    )
                }/status`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({

                            status:
                                "RESOLVED",

                            resolutionNote:
                                resolutionNote.trim()

                        })
                }
            );


            showToast(
                "Ticket resolved successfully."
            );


            await loadQueue({
                silent:
                    true
            });

        } catch (error) {

            showToast(
                error.message
            );
        }
    }


    /* =========================================================
       CLICK EVENTS
    ========================================================= */

    function setupQueueClicks() {

        const grid =
            get(
                "queueGrid"
            );


        if (!grid) {
            return;
        }


        grid.addEventListener(
            "click",
            event => {

                const openButton =
                    event.target.closest(
                        ".live-open-ticket"
                    );


                if (openButton) {

                    openTicket(
                        openButton.dataset
                            .ticketId
                    );

                    return;
                }


                const takeButton =
                    event.target.closest(
                        ".live-take-ticket"
                    );


                if (takeButton) {

                    takeTicket(
                        takeButton.dataset
                            .ticketId
                    );

                    return;
                }


                const startButton =
                    event.target.closest(
                        ".live-start-ticket"
                    );


                if (startButton) {

                    startWork(
                        startButton.dataset
                            .ticketId
                    );

                    return;
                }


                const resolveButton =
                    event.target.closest(
                        ".live-resolve-ticket"
                    );


                if (resolveButton) {

                    resolveTicket(
                        resolveButton.dataset
                            .ticketId
                    );
                }
            }
        );
    }


    /* =========================================================
       FILTER EVENTS
    ========================================================= */

    function setupFilters() {

        [
            "searchInput",
            "topSearch"
        ]
            .forEach(
                id => {

                    const input =
                        get(
                            id
                        );


                    if (!input) {
                        return;
                    }


                    input.addEventListener(
                        "input",
                        () => {

                            /*
                                Keep both search boxes
                                synchronized.
                            */

                            const other =
                                id ===
                                "searchInput"
                                    ? get(
                                        "topSearch"
                                    )
                                    : get(
                                        "searchInput"
                                    );


                            if (other) {

                                other.value =
                                    input.value;
                            }


                            setTimeout(
                                renderQueue,
                                0
                            );
                        }
                    );
                }
            );


        [
            "statusFilter",
            "priorityFilter"
        ]
            .forEach(
                id => {

                    get(
                        id
                    )?.addEventListener(
                        "change",
                        () => {

                            setTimeout(
                                renderQueue,
                                0
                            );
                        }
                    );
                }
            );


        get(
            "resetButton"
        )?.addEventListener(
            "click",
            () => {

                if (
                    get(
                        "searchInput"
                    )
                ) {

                    get(
                        "searchInput"
                    ).value =
                        "";
                }


                if (
                    get(
                        "topSearch"
                    )
                ) {

                    get(
                        "topSearch"
                    ).value =
                        "";
                }


                if (
                    get(
                        "statusFilter"
                    )
                ) {

                    get(
                        "statusFilter"
                    ).value =
                        "";
                }


                if (
                    get(
                        "priorityFilter"
                    )
                ) {

                    get(
                        "priorityFilter"
                    ).value =
                        "";
                }


                setTimeout(
                    renderQueue,
                    0
                );
            }
        );
    }


    /* =========================================================
       ERROR / EMPTY
    ========================================================= */

    function showQueueMessage(
        heading,
        message
    ) {

        const grid =
            get(
                "queueGrid"
            );


        const empty =
            get(
                "emptyState"
            );


        if (grid) {

            grid.innerHTML =
                "";
        }


        if (!empty) {
            return;
        }


        empty.style.display =
            "block";


        const title =
            empty.querySelector(
                "h3"
            );


        const copy =
            empty.querySelector(
                "p"
            );


        if (title) {

            title.textContent =
                heading;
        }


        if (copy) {

            copy.textContent =
                message;
        }
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
                2500
            );
    }


    /* =========================================================
       LIVE CSS
    ========================================================= */

    function installStyles() {

        const style =
            document.createElement(
                "style"
            );


        style.textContent = `

            .live-queue-ticket {
                transition:
                    transform .15s ease,
                    border-color .15s ease;
            }

            .live-queue-ticket:hover {
                transform:
                    translateY(-2px);
            }

            .sla.safe {
                color: #67AECA;
            }

            .sla.warning {
                color: #d0a6c0;
            }

            .sla.critical {
                color: #E52A6F;
            }

            .sla-track span.safe {
                background: #67AECA;
            }

            .sla-track span.warning {
                background: #675682;
            }

            .sla-track span.critical {
                background: #E52A6F;
            }

        `;


        document.head.appendChild(
            style
        );
    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    async function initialize() {

        installStyles();

        setupFilters();

        setupQueueClicks();


        try {

            await loadCurrentUser();

            await loadQueue();

        } catch (error) {

            console.error(
                error
            );


            showQueueMessage(
                "Unable to load queue",
                error.message
            );
        }


        refreshTimer =
            setInterval(
                () => {

                    loadQueue({
                        silent:
                            true
                    });

                },
                30000
            );
    }


    initialize();

})();
