(() => {

    const container =
        document.getElementById(
            "slaAttentionTimeline"
        );

    if (!container) {
        return;
    }


    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function valueFrom(
        object,
        keys,
        fallback = null
    ) {

        for (const key of keys) {

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


    function booleanValue(value) {

        return (
            value === true ||
            value === 1 ||
            value === "1" ||
            String(value)
                .toLowerCase() ===
                "true"
        );
    }


    function normalize(ticket) {

        return {

            id:
                valueFrom(
                    ticket,
                    ["id"]
                ),

            ticketNumber:
                valueFrom(
                    ticket,
                    [
                        "ticketNumber",
                        "ticket_number"
                    ],
                    "Ticket"
                ),

            subject:
                valueFrom(
                    ticket,
                    ["subject"],
                    "Support request"
                ),

            priority:
                String(
                    valueFrom(
                        ticket,
                        ["priority"],
                        "MEDIUM"
                    )
                ).toUpperCase(),

            status:
                String(
                    valueFrom(
                        ticket,
                        ["status"],
                        ""
                    )
                ).toUpperCase(),

            resolutionDueAt:
                valueFrom(
                    ticket,
                    [
                        "resolutionDueAt",
                        "resolution_due_at"
                    ]
                ),

            slaBreached:
                booleanValue(
                    valueFrom(
                        ticket,
                        [
                            "slaBreached",
                            "sla_breached"
                        ],
                        false
                    )
                )
        };
    }


    async function loadTickets() {

        const all = [];

        let offset = 0;

        for (
            let page = 0;
            page < 20;
            page++
        ) {

            const response =
                await fetch(
                    `/api/tickets?limit=100&offset=${offset}`,
                    {
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Unable to load SLA tickets."
                );
            }


            const batch =
                Array.isArray(data)
                    ? data
                    : (
                        data.tickets ||
                        data.data ||
                        []
                    );


            if (
                !Array.isArray(batch)
            ) {

                break;
            }


            all.push(
                ...batch
            );


            const total =
                Number(
                    data.total ??
                    data.pagination?.total
                );


            if (
                batch.length < 100 ||
                batch.length === 0 ||
                (
                    Number.isFinite(total) &&
                    all.length >= total
                )
            ) {

                break;
            }


            offset +=
                batch.length;
        }


        return all.map(
            normalize
        );
    }


    function formatRemaining(milliseconds) {

        const totalMinutes =
            Math.max(
                0,
                Math.ceil(
                    milliseconds /
                    60000
                )
            );


        if (
            totalMinutes < 60
        ) {

            return `${totalMinutes}m remaining`;
        }


        const hours =
            Math.floor(
                totalMinutes /
                60
            );

        const minutes =
            totalMinutes %
            60;


        return minutes
            ? `${hours}h ${minutes}m remaining`
            : `${hours}h remaining`;
    }


    function getAttention(ticket) {

        if (
            [
                "RESOLVED",
                "CLOSED"
            ].includes(
                ticket.status
            )
        ) {

            return null;
        }


        const now =
            Date.now();

        const due =
            ticket.resolutionDueAt
                ? new Date(
                    ticket.resolutionDueAt
                ).getTime()
                : NaN;


        const breached =
            ticket.slaBreached ||
            (
                Number.isFinite(due) &&
                due <= now
            );


        if (breached) {

            return {
                ...ticket,

                level:
                    "BREACHED",

                sort:
                    Number.isFinite(due)
                        ? due
                        : 0,

                message:
                    "Resolution SLA has been exceeded."
            };
        }


        if (
            Number.isFinite(due)
        ) {

            const remaining =
                due - now;


            if (
                remaining <=
                60 * 60 * 1000
            ) {

                return {
                    ...ticket,

                    level:
                        "AT_RISK",

                    sort:
                        due,

                    remaining,

                    message:
                        "Resolution deadline is approaching."
                };
            }
        }


        return null;
    }


    function render(tickets) {

        const items =
            tickets
                .map(
                    getAttention
                )
                .filter(Boolean)
                .sort(
                    (a, b) => {

                        if (
                            a.level !==
                            b.level
                        ) {

                            return a.level ===
                                "BREACHED"
                                ? -1
                                : 1;
                        }

                        return (
                            a.sort -
                            b.sort
                        );
                    }
                )
                .slice(
                    0,
                    4
                );


        if (
            items.length ===
            0
        ) {

            container.innerHTML = `
                <div class="timeline-item">

                    <div class="timeline-icon">
                        ✓
                    </div>

                    <div>

                        <strong>
                            No SLA attention required
                        </strong>

                        <p>
                            No current tickets are breached or within one hour of their resolution deadline.
                        </p>

                    </div>

                </div>
            `;

            return;
        }


        container.innerHTML =
            items.map(
                item => {

                    const breached =
                        item.level ===
                        "BREACHED";


                    return `
                        <div
                            class="timeline-item live-sla-attention"
                            data-ticket-id="${escapeHtml(
                                item.id
                            )}"
                            style="cursor:pointer;"
                        >

                            <div class="timeline-icon">
                                ${breached
                                    ? "!"
                                    : "↑"}
                            </div>

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        item.ticketNumber
                                    )}
                                    ${breached
                                        ? "SLA breached"
                                        : "approaching SLA"}
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        item.subject
                                    )}
                                    ·
                                    ${escapeHtml(
                                        item.priority
                                    )}
                                    priority
                                </p>

                                <time>
                                    ${breached
                                        ? "Requires immediate attention"
                                        : escapeHtml(
                                            formatRemaining(
                                                item.remaining
                                            )
                                        )}
                                </time>

                            </div>

                        </div>
                    `;
                }
            ).join("");
    }


    async function refresh() {

        try {

            const tickets =
                await loadTickets();

            render(
                tickets
            );


        } catch (error) {

            console.error(
                "SLA attention error:",
                error
            );

            container.innerHTML = `
                <div class="timeline-item">

                    <div class="timeline-icon">
                        !
                    </div>

                    <div>

                        <strong>
                            SLA attention unavailable
                        </strong>

                        <p>
                            Unable to load current SLA status.
                        </p>

                    </div>

                </div>
            `;
        }
    }


    container.addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    ".live-sla-attention"
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
                `/ticket-detail.html?id=${encodeURIComponent(
                    id
                )}`;
        }
    );


    refresh();

    setInterval(
        refresh,
        30000
    );

})();
